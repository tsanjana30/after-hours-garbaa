const test = require("node:test");
const assert = require("node:assert/strict");
const { spawn } = require("node:child_process");
const net = require("node:net");

async function availablePort() {
    const server = net.createServer();
    await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
    const port = server.address().port;
    await new Promise((resolve) => server.close(resolve));
    return port;
}

test("server starts without email or database settings and reports unavailable bookings", async () => {
    const port = await availablePort();
    const server = spawn(process.execPath, ["server.js"], {
        cwd: __dirname,
        env: {
            ...process.env,
            PORT: String(port),
            MONGODB_URI: "",
            RESEND_API_KEY: "",
            RESEND_FROM: "",
            EMAIL_USER: "",
            EMAIL_APP_PASSWORD: ""
        },
        stdio: "ignore"
    });

    try {
        let health;
        for (let attempt = 0; attempt < 150; attempt++) {
            try {
                health = await fetch(`http://127.0.0.1:${port}/api/health`);
                break;
            } catch {
                if (server.exitCode !== null) throw new Error("Server exited during startup.");
                await new Promise((resolve) => setTimeout(resolve, 100));
            }
        }

        assert.ok(health, "Server did not open its HTTP port.");
        assert.equal(health.status, 503);
        assert.equal((await health.json()).emailConfigured, false);

        const booking = await fetch(`http://127.0.0.1:${port}/api/bookings`, {
            method: "POST"
        });
        assert.equal(booking.status, 503);
        assert.equal((await booking.json()).success, false);

        const home = await fetch(`http://127.0.0.1:${port}/`);
        assert.equal(home.status, 200);
        assert.match(await home.text(), /After-Hours Garba/);
    } finally {
        server.kill();
    }
});
