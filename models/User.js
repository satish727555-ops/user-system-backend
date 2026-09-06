
const mongoose = require("mongoose");

const userSchema = new mongoose.Schema(
    {
        name: {
            type: String,
            required: true,
            trim: true,
            minlength: 3,
        },

        email: {
            type: String,
            required: true,
            unique: true,
            lowercase: true,
            trim: true,
        },

        password: {
            type: String,
            required: true,
        },

        role: {
            type: String,
            enum: ["user", "admin"],
            default: "user",
        },

        // Email verification
        isVerified: {
            type: Boolean,
            default: false,
        },

        // OTP
        otp: {
            type: String,
            default: null,
        },

        // OTP expiry time
        otpExpires: {
            type: Date,
            default: null,
        },
    },
    {
        timestamps: true,
    }
);

module.exports = mongoose.model("User", userSchema);
