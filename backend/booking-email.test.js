const test = require("node:test");
const assert = require("node:assert/strict");
const { sendBookingNotifications } = require("./booking-email");

const settings = {
    RESEND_API_KEY: "test-key",
    RESEND_FROM: "tickets@example.test",
    EMAIL_USER: "organizer@example.test"
};

test("booking sends separate customer and organizer notifications", async () => {
    const messages = [];
    const client = {
        emails: {
            send: async (message) => {
                messages.push(message);
                return { data: { id: "accepted" }, error: null };
            }
        }
    };

    const result = await sendBookingNotifications("buyer@example.test", settings, { client });

    assert.deepEqual(result, { customer: true, admin: true });
    assert.deepEqual(messages.map((message) => message.to[0]), [
        "buyer@example.test",
        "organizer@example.test"
    ]);
    assert.ok(messages.every((message) => message.from === settings.RESEND_FROM));
    assert.ok(messages.every((message) => !message.attachments));
});

test("one failed recipient does not stop the other notification", async () => {
    const recipients = [];
    const failures = {};
    const client = {
        emails: {
            send: async (message) => {
                recipients.push(message.to[0]);
                return message.to[0] === "buyer@example.test"
                    ? { data: null, error: { message: "Rejected" } }
                    : { data: { id: "accepted" }, error: null };
            }
        }
    };

    const result = await sendBookingNotifications("buyer@example.test", settings, { client, failures });

    assert.deepEqual(result, { customer: false, admin: true });
    assert.equal(failures.customer, "Rejected");
    assert.equal(failures.admin, undefined);
    assert.equal(recipients.length, 2);
});

test("retry sends only notifications that have not succeeded", async () => {
    const recipients = [];
    const client = {
        emails: {
            send: async (message) => {
                recipients.push(message.to[0]);
                return { data: { id: "accepted" }, error: null };
            }
        }
    };

    const result = await sendBookingNotifications("buyer@example.test", settings, {
        client,
        customer: false,
        admin: true
    });

    assert.deepEqual(result, { customer: false, admin: true });
    assert.deepEqual(recipients, ["organizer@example.test"]);
});

test("missing email configuration reports failure without creating a client", async () => {
    const result = await sendBookingNotifications("buyer@example.test", {});
    assert.deepEqual(result, { customer: false, admin: false });
});

test("Gmail SMTP fallback sends to customer and organizer separately", async () => {
    const messages = [];
    const transport = {
        sendMail: async (message) => {
            messages.push(message);
            return { accepted: [message.to] };
        }
    };
    const smtpSettings = {
        EMAIL_USER: "organizer@example.test",
        EMAIL_APP_PASSWORD: "test-password"
    };

    const result = await sendBookingNotifications("buyer@example.test", smtpSettings, { transport });

    assert.deepEqual(result, { customer: true, admin: true });
    assert.deepEqual(messages.map((message) => message.to), [
        "buyer@example.test",
        "organizer@example.test"
    ]);
    assert.ok(messages.every((message) => message.from === smtpSettings.EMAIL_USER));
});
