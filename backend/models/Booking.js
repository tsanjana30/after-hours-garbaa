const mongoose = require("mongoose");

const bookingSchema = new mongoose.Schema(
    {
        name: {
            type: String,
            required: true,
            trim: true
        },

        phone: {
            type: String,
            required: true,
            trim: true
        },

        email: {
            type: String,
            required: true,
            trim: true,
            lowercase: true
        },

        pass: {
            type: String,
            required: true,
            enum: [
                "Single Pass",
                "Couple Pass",
                "Group Pass"
            ]
        },

        quantity: {
            type: Number,
            required: true,
            min: 1,
            max: 20
        },

        amount: {
            type: Number,
            required: true
        },

        ticketId: {
            type: String,
            required: true,
            unique: true,
            index: true
        },

        qrToken: {
            type: String,
            required: true,
            unique: true,
            index: true
        },

        paymentScreenshot: {
            type: String,
            required: true
        },

        paymentScreenshotData: {
            type: Buffer,
            default: null,
            select: false
        },

        paymentScreenshotType: {
            type: String,
            default: null
        },

        paymentStatus: {
            type: String,
            enum: [
                "PENDING_VERIFICATION",
                "VERIFIED",
                "REJECTED"
            ],
            default: "PENDING_VERIFICATION"
        },

        checkInStatus: {
            type: String,
            enum: [
                "NOT_CHECKED_IN",
                "CHECKED_IN"
            ],
            default: "NOT_CHECKED_IN"
        },

        checkedInAt: {
            type: Date,
            default: null
        },

        // Email delivery status
        emailStatus: {
            type: String,
            enum: [
                "NOT_SENT",
                "SENT",
                "FAILED"
            ],
            default: "NOT_SENT"
        },

        emailSentAt: {
            type: Date,
            default: null
        },

        bookingEmailStatus: {
            type: String,
            enum: ["NOT_SENT", "SENT", "FAILED"],
            default: "NOT_SENT"
        },
        bookingEmailError: { type: String, default: "" },

        adminEmailStatus: {
            type: String,
            enum: ["NOT_SENT", "SENT", "FAILED"],
            default: "NOT_SENT"
        },
        adminEmailError: { type: String, default: "" },
        passEmailError: { type: String, default: "" }
    },

    {
        timestamps: true
    }
);

module.exports = mongoose.model(
    "Booking",
    bookingSchema
);
