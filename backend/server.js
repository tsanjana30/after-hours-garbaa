const express = require("express");
const cors = require("cors");
const dotenv = require("dotenv");
const crypto = require("crypto");
const mongoose = require("mongoose");
const QRCode = require("qrcode");
const multer = require("multer");
const nodemailer = require("nodemailer");
const { Resend } = require("resend");
const path = require("path");
const fs = require("fs");

const Booking = require("./models/Booking");
const { sendBookingNotifications } = require("./booking-email");

dotenv.config({ path: path.join(__dirname, ".env") });

const app = express();

const PORT = process.env.PORT || 5000;


// ======================================================
// EMAIL CONFIGURATION
// ======================================================

const resend = process.env.RESEND_API_KEY
    ? new Resend(process.env.RESEND_API_KEY)
    : null;

const RESEND_FROM = process.env.RESEND_FROM;
const smtp = process.env.EMAIL_USER && process.env.EMAIL_APP_PASSWORD
    ? nodemailer.createTransport({
        service: "gmail",
        auth: { user: process.env.EMAIL_USER, pass: process.env.EMAIL_APP_PASSWORD },
        connectionTimeout: 10000,
        greetingTimeout: 10000,
        socketTimeout: 10000
    })
    : null;

function escapeHtml(value) {
    return String(value ?? "").replace(/[&<>"']/g, (character) => ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#39;"
    })[character]);
}


// ======================================================
// SEND VERIFIED PASS BY EMAIL
// ======================================================

async function sendPassEmail(booking) {

    try {

        if (!(resend && RESEND_FROM) && !smtp) {
            throw new Error("Pass email needs a verified Resend sender or Gmail app-password settings.");
        }

        const qrBuffer = await QRCode.toBuffer(
            booking.qrToken,
            {
                type: "png",
                width: 500,
                margin: 2
            }
        );

        const message = {

            from: RESEND_FROM,

            to: [booking.email],


            subject: "Your After-Hours Garba Pass is Confirmed 🎉",

            html: `

                <div style="
                    font-family: Arial, sans-serif;
                    background: #120812;
                    padding: 30px;
                    color: #ffffff;
                ">

                    <div style="
                        max-width: 600px;
                        margin: auto;
                        background: #1d101d;
                        border-radius: 16px;
                        padding: 30px;
                        border: 1px solid #8f6b25;
                    ">

                        <h1 style="
                            text-align: center;
                            color: #f5c76b;
                            margin-bottom: 8px;
                        ">
                            After-Hours Garba
                        </h1>

                        <p style="
                            text-align: center;
                            color: #f0d9a0;
                            margin-top: 0;
                        ">
                            Presented by Sri Medha
                        </p>

                        <hr style="
                            border: 0;
                            border-top: 1px solid #5d465d;
                            margin: 25px 0;
                        ">

                        <h2 style="
                            color: #f5c76b;
                        ">
                            Booking Confirmed 🎉
                        </h2>

                        <p>
                            Hi <strong>${escapeHtml(booking.name)}</strong>,
                        </p>

                        <p>
                            Your payment has been verified and your
                            After-Hours Garba entry pass is confirmed.
                        </p>

                        <div style="
                            background: #281729;
                            padding: 20px;
                            border-radius: 12px;
                            margin: 20px 0;
                        ">

                            <p>
                                <strong>Pass:</strong>
                                ${booking.pass}
                            </p>

                            <p>
                                <strong>Quantity:</strong>
                                ${booking.quantity}
                            </p>

                            <p>
                                <strong>Amount:</strong>
                                ₹${booking.amount}
                            </p>

                            <p>
                                <strong>Pass ID:</strong>
                                ${booking.ticketId}
                            </p>

                            <p>
                                <strong>Event:</strong>
                                After-Hours Garba
                            </p>

                            <p>
                                <strong>Date:</strong>
                                Saturday, 17th October 2026
                            </p>

                            <p>
                                <strong>Time:</strong>
                                6 PM onwards
                            </p>

                            <p>
                                <strong>Venue:</strong>
                                Neelakanta Resort and Convention, Nalgonda
                            </p>

                        </div>

                        <div style="
                            text-align: center;
                            margin: 30px 0;
                        ">

                            <p style="
                                color: #f5c76b;
                                font-weight: bold;
                            ">
                                Scan this QR code at the entrance
                            </p>

                            <img
                                src="cid:garbaqr"
                                alt="Entry QR Code"
                                style="
                                    width: 300px;
                                    max-width: 100%;
                                    background: white;
                                    padding: 10px;
                                    border-radius: 10px;
                                "
                            >

                        </div>

                        <p style="
                            color: #d8cbd8;
                            font-size: 14px;
                            text-align: center;
                        ">
                            Please keep this email and QR code
                            available when you arrive.
                        </p>

                    </div>

                </div>

            `,

            attachments: [

                {
                    filename: `${booking.ticketId}-QR.png`,
                    content: qrBuffer.toString("base64"),
                    contentType: "image/png",
                    contentId: "garbaqr"
                }

            ]

        };

        let deliveryId;
        if (resend && RESEND_FROM) {
            const { data, error } = await resend.emails.send(message);
            if (error) throw error;
            deliveryId = data?.id;
        } else {
            const info = await smtp.sendMail({
                ...message,
                from: process.env.EMAIL_USER,
                to: booking.email,
                attachments: [{
                    filename: `${booking.ticketId}-QR.png`,
                    content: qrBuffer,
                    contentType: "image/png",
                    cid: "garbaqr"
                }]
            });
            if (!info?.accepted?.some((address) => address.toLowerCase() === booking.email.toLowerCase())) {
                throw new Error("SMTP server did not accept the pass recipient.");
            }
            deliveryId = info.messageId;
        }

        if (!deliveryId) throw new Error("Email provider did not confirm pass email acceptance.");

        booking.emailStatus = "SENT";
        booking.passEmailError = "";
        booking.emailSentAt = new Date();

        await booking.save();

        console.log(
            `Pass email sent to ${booking.email}`
        );

        console.log(
            "Email delivery ID:",
            deliveryId
        );

        return true;

    } catch (error) {

        console.error(
            "Pass email error:",
            error
        );

        try {

            booking.emailStatus = "FAILED";
            booking.passEmailError = String(error?.message || error).slice(0, 300);

            await booking.save();

        } catch (saveError) {

            console.error(
                "Could not update email status:",
                saveError
            );

        }

        return false;

    }

}


// ======================================================
// MIDDLEWARE
// ======================================================

app.use(
    cors()
);

app.use(
    express.json()
);

app.use(
    express.urlencoded({
        extended: true
    })
);


// ======================================================
// SERVE FRONTEND
// ======================================================

app.use(
    express.static(
        path.join(
            __dirname,
            "..",
            "frontend"
        )
    )
);


// ======================================================
// EVENT INFORMATION
// ======================================================

const EVENT_NAME =
    "After-Hours Garba";

const EVENT_DATE =
    "Saturday, 17th October 2026";

const EVENT_TIME =
    "6 PM onwards";

const EVENT_VENUE =
    "Neelakanta Resort and Convention, Nalgonda";


// ======================================================
// NEW UPI ID
// ======================================================

const UPI_ID =
    "Q98338110@ybl";


// ======================================================
// REGULAR PRICES ONLY
// ======================================================

const PRICES = {

    "Single Pass": 399,

    "Couple Pass": 699,

    "Group Pass": 1399

};


// ======================================================
// UPLOAD CONFIGURATION
// ======================================================

const uploadDirectory = path.join(__dirname, 'uploads');

const upload =
    multer({

        storage:

            multer.memoryStorage(),

        limits: {

            fileSize:
                3 * 1024 * 1024

        },

        fileFilter:
            function (
                req,
                file,
                cb
            ) {

                const allowedTypes = [

                    "image/jpeg",

                    "image/png",

                    "image/webp"

                ];


                if (
                    allowedTypes.includes(
                        file.mimetype
                    )
                ) {

                    cb(
                        null,
                        true
                    );

                } else {

                    cb(
                        new Error(
                            "Only JPG, PNG and WEBP images are allowed."
                        )
                    );

                }

            }

    });

function isValidImage(file) {
    const bytes = file?.buffer;
    if (!Buffer.isBuffer(bytes)) return false;
    if (file.mimetype === "image/png") {
        return bytes.length >= 8 && bytes.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]));
    }
    if (file.mimetype === "image/jpeg") {
        return bytes.length >= 4 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[bytes.length - 2] === 0xff && bytes[bytes.length - 1] === 0xd9;
    }
    if (file.mimetype === "image/webp") {
        return bytes.length >= 12 && bytes.toString("ascii", 0, 4) === "RIFF" && bytes.toString("ascii", 8, 12) === "WEBP";
    }
    return false;
}


// ======================================================
// MONGODB CONNECTION
// ======================================================

let databasePromise;

async function ensureDatabase() {
    if (mongoose.connection.readyState === 1) return;
    if (!process.env.MONGODB_URI) throw new Error("MONGODB_URI is missing.");
    if (!databasePromise) {
        databasePromise = mongoose.connect(process.env.MONGODB_URI, { serverSelectionTimeoutMS: 10000 })
            .then(() => console.log("MongoDB connected successfully."))
            .catch((error) => {
                databasePromise = undefined;
                throw error;
            });
    }
    await databasePromise;
}


// ======================================================
// HEALTH CHECK
// ======================================================

app.get(
    "/api/health",
    async (req, res) => {

        let databaseReady = false;
        try {
            await ensureDatabase();
            databaseReady = true;
        } catch (error) {
            console.error("Health check database error:", error.message);
        }

        res.status(databaseReady ? 200 : 503).json({

            success: databaseReady,

            message:
                databaseReady
                    ? "After-Hours Garba backend is ready."
                    : "Database is unavailable.",

            emailConfigured: Boolean(
                (process.env.RESEND_API_KEY && process.env.RESEND_FROM && process.env.EMAIL_USER) ||
                (process.env.EMAIL_USER && process.env.EMAIL_APP_PASSWORD)
            ),

            emailProvider: process.env.RESEND_API_KEY && process.env.RESEND_FROM
                ? "resend"
                : smtp ? "gmail_smtp" : null

        });

    }
);


// ======================================================
// GET PRICES
// ======================================================

app.get(
    "/api/prices",
    (req, res) => {

        res.json({

            success: true,

            prices: PRICES,

            upiId:
                UPI_ID,

            event: {

                name:
                    EVENT_NAME,

                date:
                    EVENT_DATE,

                time:
                    EVENT_TIME,

                venue:
                    EVENT_VENUE

            }

        });

    }
);


// ======================================================
// REQUIRE DATABASE FOR BOOKING AND ADMIN ROUTES
// ======================================================

app.use("/api", async (req, res, next) => {
    try {
        await ensureDatabase();
        next();
    } catch (error) {
        console.error("Booking database unavailable:", error.message);
        return res.status(503).json({
            success: false,
            message: "Booking service is temporarily unavailable. Please try again shortly."
        });
    }
});


// ======================================================
// CREATE BOOKING
// ======================================================

app.post(
    "/api/bookings",
    upload.single("paymentScreenshot"),
    async (req, res) => {

        try {

            const {

                name,

                phone,

                email,

                pass,

                quantity

            } = req.body;


            // ------------------------------------------
            // VALIDATE REQUIRED FIELDS
            // ------------------------------------------

            if (
                !name ||
                !phone ||
                !email ||
                !pass ||
                !quantity
            ) {

                return res.status(400).json({

                    success: false,

                    message:
                        "All booking fields are required."

                });

            }

            if (
                typeof name !== "string" || name.trim().length < 2 || name.trim().length > 100 ||
                typeof phone !== "string" || !/^[+\d\s()-]{7,20}$/.test(phone.trim()) ||
                typeof email !== "string" || email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim()) ||
                typeof pass !== "string"
            ) {
                return res.status(400).json({
                    success: false,
                    message: "Please enter a valid name, phone number and email address."
                });
            }


            // ------------------------------------------
            // VALIDATE PASS
            // ------------------------------------------

            if (
                !Object.prototype.hasOwnProperty.call(
                    PRICES,
                    pass
                )
            ) {

                return res.status(400).json({

                    success: false,

                    message:
                        "Invalid pass selected."

                });

            }


            // ------------------------------------------
            // VALIDATE QUANTITY
            // ------------------------------------------

            const parsedQuantity =
                Number(quantity);


            if (
                !Number.isInteger(
                    parsedQuantity
                ) ||
                parsedQuantity < 1 ||
                parsedQuantity > 20
            ) {

                return res.status(400).json({

                    success: false,

                    message:
                        "Quantity must be between 1 and 20."

                });

            }


            // ------------------------------------------
            // VALIDATE SCREENSHOT
            // ------------------------------------------

            if (
                !req.file
            ) {

                return res.status(400).json({

                    success: false,

                    message:
                        "Payment screenshot is required."

                });

            }

            if (!isValidImage(req.file)) {
                return res.status(400).json({
                    success: false,
                    message: "Payment screenshot must be a valid JPG, PNG or WEBP image."
                });
            }


            // ------------------------------------------
            // CALCULATE AMOUNT
            // ------------------------------------------

            const amount =
                PRICES[pass] *
                parsedQuantity;


            // ------------------------------------------
            // GENERATE TICKET ID
            // ------------------------------------------

            const randomTicket =
                crypto
                    .randomBytes(8)
                    .toString("hex")
                    .toUpperCase();


            const ticketId =
                `AHG-2026-${randomTicket}`;


            // ------------------------------------------
            // GENERATE QR TOKEN
            // ------------------------------------------

            const qrToken =
                crypto
                    .randomBytes(32)
                    .toString("hex");


            // ------------------------------------------
            // CREATE BOOKING
            // ------------------------------------------

            const booking =
                new Booking({

                    name:
                        name.trim(),

                    phone:
                        phone.trim(),

                    email:
                        email.trim().toLowerCase(),

                    pass:
                        pass,

                    quantity:
                        parsedQuantity,

                    amount:
                        amount,

                    ticketId:
                        ticketId,

                    qrToken:
                        qrToken,

                    paymentScreenshot:
                        `${ticketId}${req.file.mimetype === "image/png" ? ".png" : req.file.mimetype === "image/webp" ? ".webp" : ".jpg"}`,

                    paymentScreenshotData:
                        req.file.buffer,

                    paymentScreenshotType:
                        req.file.mimetype,

                    paymentStatus:
                        "PENDING_VERIFICATION",

                    checkInStatus:
                        "NOT_CHECKED_IN",

                    emailStatus:
                        "NOT_SENT"

                });


            await booking.save();


            // ------------------------------------------
            // NOTIFY CUSTOMER AND ADMIN
            // ------------------------------------------

            const failures = {};
            const emails = await sendBookingNotifications(booking.email, process.env, { failures });

            booking.bookingEmailStatus = emails.customer ? "SENT" : "FAILED";
            booking.adminEmailStatus = emails.admin ? "SENT" : "FAILED";
            booking.bookingEmailError = emails.customer ? "" : failures.customer || "Email delivery was not accepted.";
            booking.adminEmailError = emails.admin ? "" : failures.admin || "Email delivery was not accepted.";

            try {
                await booking.save();
            } catch (statusError) {
                console.error("Could not save booking email status:", statusError);
            }


            // ------------------------------------------
            // RESPONSE
            // ------------------------------------------

            return res.status(201).json({

                success: true,

                message:
                    "Booking submitted successfully. Payment is pending verification.",

                emails,

                booking: {

                    ticketId:
                        booking.ticketId,

                    name:
                        booking.name,

                    phone:
                        booking.phone,

                    email:
                        booking.email,

                    pass:
                        booking.pass,

                    quantity:
                        booking.quantity,

                    amount:
                        booking.amount,

                    paymentStatus:
                        booking.paymentStatus,

                    event: {

                        name:
                            EVENT_NAME,

                        date:
                            EVENT_DATE,

                        time:
                            EVENT_TIME,

                        venue:
                            EVENT_VENUE

                    }

                }

            });

        } catch (error) {

            console.error(
                "Create booking error:",
                error
            );


            return res.status(500).json({

                success: false,

                message:
                    "Could not create booking."

            });

        }

    }
);


// ======================================================
// GET BOOKING BY TICKET ID
// ======================================================

app.get(
    "/api/booking/:ticketId",
    async (req, res) => {

        try {

            const booking =
                await Booking.findOne({

                    ticketId:
                        req.params.ticketId

                }).select(
                    "ticketId name pass quantity amount paymentStatus checkInStatus emailStatus bookingEmailStatus"
                );


            if (
                !booking
            ) {

                return res.status(404).json({

                    success: false,

                    message:
                        "Booking not found."

                });

            }


            return res.json({

                success: true,

                booking:
                    booking

            });

        } catch (error) {

            console.error(
                "Get booking error:",
                error
            );


            return res.status(500).json({

                success: false,

                message:
                    "Could not retrieve booking."

            });

        }

    }
);


// ======================================================
// ADMIN AUTHENTICATION
// ======================================================

function requireAdmin(
    req,
    res,
    next
) {

    const adminKey =
        req.headers["x-admin-key"];


    if (
        !adminKey ||
        adminKey !== process.env.ADMIN_KEY
    ) {

        return res.status(401).json({

            success: false,

            message:
                "Unauthorized."

        });

    }


    next();

}

app.get("/api/admin/auth", requireAdmin, (req, res) => {
    res.json({ success: true });
});


// ======================================================
// GET PENDING BOOKINGS
// ======================================================

app.get(
    "/api/admin/pending",
    requireAdmin,
    async (req, res) => {

        try {

            const bookings =
                await Booking.find({

                    paymentStatus:
                        "PENDING_VERIFICATION"

                })
                .sort({
                    createdAt: -1
                })
                .select(
                    "-qrToken"
                );


            return res.json({

                success: true,

                bookings:
                    bookings

            });

        } catch (error) {

            console.error(
                "Get pending bookings error:",
                error
            );


            return res.status(500).json({

                success: false,

                message:
                    "Could not retrieve pending bookings."

            });

        }

    }
);


// ======================================================
// ADMIN BOOKING HISTORY
// ======================================================

app.get("/api/admin/bookings", requireAdmin, async (req, res) => {
    try {
        const status = String(req.query.status || "PENDING_VERIFICATION");
        const validStatuses = ["ALL", "PENDING_VERIFICATION", "VERIFIED", "REJECTED"];
        if (!validStatuses.includes(status)) {
            return res.status(400).json({ success: false, message: "Invalid booking status filter." });
        }

        const page = Number(req.query.page || 1);
        if (!Number.isInteger(page) || page < 1 || page > 100000) {
            return res.status(400).json({ success: false, message: "Invalid page number." });
        }

        const search = String(req.query.search || "").trim().slice(0, 100);
        const filter = {};
        if (status !== "ALL") filter.paymentStatus = status;
        if (search) {
            const safeSearch = search.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
            const pattern = new RegExp(safeSearch, "i");
            filter.$or = [
                { ticketId: pattern }, { name: pattern },
                { email: pattern }, { phone: pattern }
            ];
        }

        const limit = 20;
        const [bookings, total, statusTotals] = await Promise.all([
            Booking.find(filter)
                .sort({ createdAt: -1, _id: -1 })
                .skip((page - 1) * limit)
                .limit(limit)
                .select("ticketId name phone email pass quantity amount paymentStatus checkInStatus checkedInAt emailStatus emailSentAt bookingEmailStatus adminEmailStatus bookingEmailError adminEmailError passEmailError createdAt updatedAt"),
            Booking.countDocuments(filter),
            Booking.aggregate([{ $group: {
                _id: "$paymentStatus",
                count: { $sum: 1 },
                amount: { $sum: "$amount" }
            } }])
        ]);

        const summary = { pending: 0, verified: 0, rejected: 0, pendingAmount: 0 };
        for (const row of statusTotals) {
            if (row._id === "PENDING_VERIFICATION") {
                summary.pending = row.count;
                summary.pendingAmount = row.amount;
            } else if (row._id === "VERIFIED") summary.verified = row.count;
            else if (row._id === "REJECTED") summary.rejected = row.count;
        }

        return res.json({
            success: true,
            bookings,
            summary,
            pagination: { page, limit, total, pages: Math.max(1, Math.ceil(total / limit)) }
        });
    } catch (error) {
        console.error("Get admin booking history error:", error);
        return res.status(500).json({ success: false, message: "Could not retrieve booking history." });
    }
});


// ======================================================
// GET PAYMENT SCREENSHOT
// ======================================================

app.get(
    "/api/admin/payment-screenshot/:ticketId",
    requireAdmin,
    async (req, res) => {

        try {

            const booking =
                await Booking.findOne({

                    ticketId:
                        req.params.ticketId

                }).select("+paymentScreenshotData");


            if (
                !booking
            ) {

                return res.status(404).json({

                    success: false,

                    message:
                        "Booking not found."

                });

            }


            res.setHeader("Cache-Control", "private, no-store");

            if (booking.paymentScreenshotData) {
                res.setHeader("Content-Type", booking.paymentScreenshotType || "application/octet-stream");
                return res.send(booking.paymentScreenshotData);
            }


            const screenshotPath =
                path.join(
                    uploadDirectory,
                    booking.paymentScreenshot
                );


            if (
                !fs.existsSync(
                    screenshotPath
                )
            ) {

                return res.status(404).json({

                    success: false,

                    message:
                        "Payment screenshot not found."

                });

            }


            return res.sendFile(
                screenshotPath
            );

        } catch (error) {

            console.error(
                "Get payment screenshot error:",
                error
            );


            return res.status(500).json({

                success: false,

                message:
                    "Could not retrieve screenshot."

            });

        }

    }
);


// ======================================================
// RETRY BOOKING NOTIFICATIONS
// ======================================================

app.post("/api/admin/retry-booking-emails/:ticketId", requireAdmin, async (req, res) => {
    try {
        const booking = await Booking.findOne({ ticketId: req.params.ticketId });
        if (!booking) {
            return res.status(404).json({ success: false, message: "Booking not found." });
        }

        if (booking.paymentStatus !== "PENDING_VERIFICATION") {
            return res.status(409).json({
                success: false,
                message: "Booking notification retries are available only while payment is pending."
            });
        }

        const retryCustomer = booking.bookingEmailStatus !== "SENT";
        const retryAdmin = booking.adminEmailStatus !== "SENT";
        if (!retryCustomer && !retryAdmin) {
            return res.json({ success: true, message: "Both booking emails have already been sent." });
        }

        const failures = {};
        const emails = await sendBookingNotifications(booking.email, process.env, {
            customer: retryCustomer,
            admin: retryAdmin,
            failures
        });
        if (retryCustomer) {
            booking.bookingEmailStatus = emails.customer ? "SENT" : "FAILED";
            booking.bookingEmailError = emails.customer ? "" : failures.customer || "Email delivery was not accepted.";
        }
        if (retryAdmin) {
            booking.adminEmailStatus = emails.admin ? "SENT" : "FAILED";
            booking.adminEmailError = emails.admin ? "" : failures.admin || "Email delivery was not accepted.";
        }
        await booking.save();

        return res.json({
            success: true,
            message: booking.bookingEmailStatus === "SENT" && booking.adminEmailStatus === "SENT"
                ? "Both booking emails have been sent."
                : "One or more emails could not be sent. Check the email settings and server logs.",
            bookingEmailStatus: booking.bookingEmailStatus,
            adminEmailStatus: booking.adminEmailStatus
        });
    } catch (error) {
        console.error("Retry booking emails error:", error);
        return res.status(500).json({ success: false, message: "Could not retry booking emails." });
    }
});


// ======================================================
// VERIFY BOOKING
// ======================================================

app.post(
    "/api/admin/verify/:ticketId",
    requireAdmin,
    async (req, res) => {

        try {

            const booking =
                await Booking.findOne({

                    ticketId:
                        req.params.ticketId

                });


            if (
                !booking
            ) {

                return res.status(404).json({

                    success: false,

                    message:
                        "Booking not found."

                });

            }


            if (
                booking.paymentStatus ===
                "VERIFIED"
            ) {

                if (booking.emailStatus === "SENT") {
                    return res.json({
                        success: true,
                        message: "Booking is already verified and the pass email was sent.",
                        emailSent: true,
                        emailStatus: booking.emailStatus
                    });
                }

                const emailSent = await sendPassEmail(booking);
                return res.json({
                    success: true,
                    message: emailSent
                        ? "Pass email sent again."
                        : "Pass email could not be sent. Check the email settings and retry later.",
                    emailSent,
                    emailStatus: booking.emailStatus
                });

            }


            if (
                booking.paymentStatus ===
                "REJECTED"
            ) {

                return res.status(400).json({

                    success: false,

                    message:
                        "Rejected booking cannot be verified."

                });

            }


            // ------------------------------------------
            // MARK PAYMENT VERIFIED
            // ------------------------------------------

            booking.paymentStatus =
                "VERIFIED";


            await booking.save();


            // ------------------------------------------
            // SEND PASS EMAIL
            // ------------------------------------------

            const emailSent =
                await sendPassEmail(
                    booking
                );


            // ------------------------------------------
            // RESPONSE
            // ------------------------------------------

            return res.json({

                success: true,

                message:
                    emailSent
                        ? "Booking verified and pass email sent."
                        : "Booking verified, but pass email could not be sent.",

                emailSent:
                    emailSent,

                emailStatus:
                    booking.emailStatus,

                booking: {

                    ticketId:
                        booking.ticketId,

                    name:
                        booking.name,

                    phone:
                        booking.phone,

                    email:
                        booking.email,

                    pass:
                        booking.pass,

                    quantity:
                        booking.quantity,

                    amount:
                        booking.amount,

                    paymentStatus:
                        booking.paymentStatus,

                    emailStatus:
                        booking.emailStatus

                }

            });

        } catch (error) {

            console.error(
                "Verify booking error:",
                error
            );


            return res.status(500).json({

                success: false,

                message:
                    "Could not verify booking."

            });

        }

    }
);


// ======================================================
// RESEND A VERIFIED PASS
// ======================================================

app.post("/api/admin/resend-pass/:ticketId", requireAdmin, async (req, res) => {
    try {
        const booking = await Booking.findOne({ ticketId: req.params.ticketId });
        if (!booking) {
            return res.status(404).json({ success: false, message: "Booking not found." });
        }
        if (booking.paymentStatus !== "VERIFIED") {
            return res.status(409).json({ success: false, message: "Payment must be verified before a pass can be sent." });
        }
        if (booking.emailStatus === "SENT") {
            return res.json({ success: true, message: "Pass email was already sent." });
        }

        const emailSent = await sendPassEmail(booking);
        return res.json({
            success: true,
            emailSent,
            message: emailSent
                ? "Pass email sent."
                : "Pass email could not be sent. Check email settings and retry later."
        });
    } catch (error) {
        console.error("Resend pass error:", error);
        return res.status(500).json({ success: false, message: "Could not resend pass." });
    }
});


// ======================================================
// REJECT BOOKING
// ======================================================

app.post(
    "/api/admin/reject/:ticketId",
    requireAdmin,
    async (req, res) => {

        try {

            const booking =
                await Booking.findOne({

                    ticketId:
                        req.params.ticketId

                });


            if (
                !booking
            ) {

                return res.status(404).json({

                    success: false,

                    message:
                        "Booking not found."

                });

            }


            if (
                booking.paymentStatus ===
                "VERIFIED"
            ) {

                return res.status(400).json({

                    success: false,

                    message:
                        "Verified booking cannot be rejected."

                });

            }


            booking.paymentStatus =
                "REJECTED";


            await booking.save();


            return res.json({

                success: true,

                message:
                    "Booking rejected.",

                booking: {

                    ticketId:
                        booking.ticketId,

                    paymentStatus:
                        booking.paymentStatus

                }

            });

        } catch (error) {

            console.error(
                "Reject booking error:",
                error
            );


            return res.status(500).json({

                success: false,

                message:
                    "Could not reject booking."

            });

        }

    }
);


// ======================================================
// GET VERIFIED TICKET QR
// ======================================================

app.get(
    "/api/ticket/:ticketId/qr",
    async (req, res) => {

        try {

            const booking =
                await Booking.findOne({

                    ticketId:
                        req.params.ticketId

                });


            if (
                !booking
            ) {

                return res.status(404).json({

                    success: false,

                    message:
                        "Ticket not found."

                });

            }


            if (
                booking.paymentStatus !==
                "VERIFIED"
            ) {

                return res.status(403).json({

                    success: false,

                    message:
                        "Payment has not been verified."

                });

            }


            const qrBuffer =
                await QRCode.toBuffer(
                    booking.qrToken,
                    {
                        type: "png",
                        width: 600,
                        margin: 2
                    }
                );


            res.setHeader(
                "Content-Type",
                "image/png"
            );


            return res.send(
                qrBuffer
            );

        } catch (error) {

            console.error(
                "Generate ticket QR error:",
                error
            );


            return res.status(500).json({

                success: false,

                message:
                    "Could not generate QR code."

            });

        }

    }
);


// ======================================================
// GET BOOKING BY QR TOKEN
// ======================================================

app.get(
    "/api/ticket/qr/:qrToken",
    requireAdmin,
    async (req, res) => {

        try {

            const booking =
                await Booking.findOne({

                    qrToken:
                        req.params.qrToken

                }).select(
                    "-paymentScreenshot"
                );


            if (
                !booking
            ) {

                return res.status(404).json({

                    success: false,

                    status:
                        "ENTRY_DENIED",

                    message:
                        "Invalid QR code."

                });

            }


            if (
                booking.paymentStatus !==
                "VERIFIED"
            ) {

                return res.status(403).json({

                    success: false,

                    status:
                        "ENTRY_DENIED",

                    message:
                        "Payment has not been verified."

                });

            }


            return res.json({

                success: true,

                booking: {

                    name:
                        booking.name,

                    phone:
                        booking.phone,

                    email:
                        booking.email,

                    pass:
                        booking.pass,

                    quantity:
                        booking.quantity,

                    amount:
                        booking.amount,

                    ticketId:
                        booking.ticketId,

                    paymentStatus:
                        booking.paymentStatus,

                    checkInStatus:
                        booking.checkInStatus,

                    checkedInAt:
                        booking.checkedInAt

                }

            });

        } catch (error) {

            console.error(
                "Get QR ticket error:",
                error
            );


            return res.status(500).json({

                success: false,

                message:
                    "Could not retrieve ticket."

            });

        }

    }
);


// ======================================================
// CHECK IN TICKET
// ======================================================

app.post(
    "/api/checkin",
    requireAdmin,
    async (req, res) => {

        try {

            const {
                qrToken
            } = req.body;


            if (
                !qrToken
            ) {

                return res.status(400).json({

                    success: false,

                    status:
                        "ENTRY_DENIED",

                    message:
                        "QR token is required."

                });

            }


            // ------------------------------------------
            // ATOMIC CHECK-IN
            // ------------------------------------------

            const checkedInBooking =
                await Booking.findOneAndUpdate(

                    {

                        qrToken:
                            qrToken,

                        paymentStatus:
                            "VERIFIED",

                        checkInStatus:
                            "NOT_CHECKED_IN"

                    },

                    {

                        $set: {

                            checkInStatus:
                                "CHECKED_IN",

                            checkedInAt:
                                new Date()

                        }

                    },

                    {

                        returnDocument: "after"

                    }

                );


            // ------------------------------------------
            // SUCCESSFUL CHECK-IN
            // ------------------------------------------

            if (
                checkedInBooking
            ) {

                return res.json({

                    success: true,

                    status:
                        "ENTRY_ALLOWED",

                    message:
                        "Entry allowed. QR code checked in successfully.",

                    booking: {

                        name:
                            checkedInBooking.name,

                        phone:
                            checkedInBooking.phone,

                        email:
                            checkedInBooking.email,

                        pass:
                            checkedInBooking.pass,

                        quantity:
                            checkedInBooking.quantity,

                        amount:
                            checkedInBooking.amount,

                        ticketId:
                            checkedInBooking.ticketId,

                        checkInStatus:
                            checkedInBooking.checkInStatus,

                        checkedInAt:
                            checkedInBooking.checkedInAt

                    }

                });

            }


            // ------------------------------------------
            // FIND EXISTING BOOKING
            // ------------------------------------------

            const existingBooking =
                await Booking.findOne({

                    qrToken:
                        qrToken

                });


            // ------------------------------------------
            // INVALID QR
            // ------------------------------------------

            if (
                !existingBooking
            ) {

                return res.status(404).json({

                    success: false,

                    status:
                        "ENTRY_DENIED",

                    message:
                        "Invalid QR code."

                });

            }


            // ------------------------------------------
            // ALREADY CHECKED IN
            // ------------------------------------------

            if (
                existingBooking.checkInStatus ===
                "CHECKED_IN"
            ) {

                return res.status(409).json({

                    success: false,

                    status:
                        "ENTRY_ALREADY_USED",

                    message:
                        "This QR code has already been used.",

                    booking: {

                        name:
                            existingBooking.name,

                        phone:
                            existingBooking.phone,

                        email:
                            existingBooking.email,

                        pass:
                            existingBooking.pass,

                        quantity:
                            existingBooking.quantity,

                        amount:
                            existingBooking.amount,

                        ticketId:
                            existingBooking.ticketId,

                        checkInStatus:
                            existingBooking.checkInStatus,

                        checkedInAt:
                            existingBooking.checkedInAt

                    }

                });

            }


            // ------------------------------------------
            // PAYMENT NOT VERIFIED
            // ------------------------------------------

            return res.status(403).json({

                success: false,

                status:
                    "ENTRY_DENIED",

                message:
                    "Payment has not been verified."

            });

        } catch (error) {

            console.error(
                "Check-in error:",
                error
            );


            return res.status(500).json({

                success: false,

                status:
                    "SERVER_ERROR",

                message:
                    "Could not verify ticket."

            });

        }

    }
);


// ======================================================
// MULTER / GENERAL ERROR HANDLER
// ======================================================

app.use(

    (
        error,
        req,
        res,
        next
    ) => {

        if (
            error instanceof
            multer.MulterError
        ) {

            return res.status(400).json({

                success: false,

                message:
                    error.message

            });

        }


        if (error) {
            if (error.message === "Only JPG, PNG and WEBP images are allowed.") {
                return res.status(400).json({ success: false, message: error.message });
            }

            console.error(
                "Server error:",
                error
            );


            return res.status(500).json({

                success: false,

                message:
                    "Internal server error."

            });

        }


        next();

    }

);


// ======================================================
// START SERVER
// ======================================================

if (require.main === module) {
ensureDatabase().catch((error) => console.error("MongoDB connection error:", error.message));
app.listen(

    PORT,

    "0.0.0.0",

    () => {

        console.log(
            `Server running on port ${PORT}`
        );

        console.log(
            "Regular prices:"
        );

        console.log(
            `Single Pass: ₹${PRICES["Single Pass"]}`
        );

        console.log(
            `Couple Pass: ₹${PRICES["Couple Pass"]}`
        );

        console.log(
            `Group Pass: ₹${PRICES["Group Pass"]}`
        );

        console.log(
            `UPI ID: ${UPI_ID}`
        );

    }

);
}

module.exports = app;
