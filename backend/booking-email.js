const { Resend } = require("resend");
const nodemailer = require("nodemailer");

async function sendBookingNotifications(customerAddress, settings = process.env, options = {}) {
    const result = { customer: false, admin: false };
    const failures = options.failures || {};
    const sendCustomer = options.customer !== false;
    const sendAdmin = options.admin !== false;

    const useResend = Boolean(settings.RESEND_API_KEY && settings.RESEND_FROM);
    const useSmtp = !useResend && Boolean(settings.EMAIL_USER && settings.EMAIL_APP_PASSWORD);

    if (!useResend && !useSmtp) {
        const message = "Email sender is not configured. Set a verified Resend sender or Gmail app password.";
        if (sendCustomer) failures.customer = message;
        if (sendAdmin) failures.admin = message;
        console.error(message);
        return result;
    }

    const resend = useResend ? (options.client || new Resend(settings.RESEND_API_KEY)) : null;
    const smtp = useSmtp ? (options.transport || nodemailer.createTransport({
        service: "gmail",
        auth: { user: settings.EMAIL_USER, pass: settings.EMAIL_APP_PASSWORD },
        connectionTimeout: 10000,
        greetingTimeout: 10000,
        socketTimeout: 10000
    })) : null;

    async function send(kind, recipient, to, subject, html) {
        if (!to) {
            failures[recipient] = "Email recipient is not configured.";
            console.error(`${kind} email recipient is not configured.`);
            return false;
        }
        try {
            if (resend) {
                const { data, error } = await resend.emails.send({
                    from: settings.RESEND_FROM,
                    to: [to],
                    subject,
                    html
                });
                if (error) throw error;
                if (!data?.id) throw new Error("Email provider did not confirm acceptance.");
            } else {
                const info = await smtp.sendMail({
                    from: settings.EMAIL_USER,
                    to,
                    subject,
                    html
                });
                if (!info?.accepted?.some((address) => address.toLowerCase() === to.toLowerCase())) {
                    throw new Error("SMTP server did not accept the recipient.");
                }
            }
            return true;
        } catch (error) {
            failures[recipient] = String(error?.message || error).slice(0, 300);
            console.error(`${kind} email failed:`, error);
            return false;
        }
    }

    [result.customer, result.admin] = await Promise.all([
        sendCustomer ? send(
            "Customer booking",
            "customer",
            customerAddress,
            "After-Hours Garba booking received",
            "<p>Your booking was received. Payment is pending verification. Your entry pass will be emailed after verification.</p>"
        ) : Promise.resolve(false),
        sendAdmin ? send(
            "Admin booking",
            "admin",
            settings.EMAIL_USER,
            "New After-Hours Garba booking",
            "<p>A new booking is awaiting payment verification. Sign in to the admin page to review it.</p>"
        ) : Promise.resolve(false)
    ]);

    if (useSmtp && !options.transport) smtp.close();

    return result;
}

module.exports = { sendBookingNotifications };
