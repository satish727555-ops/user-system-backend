const PendingUser = require("../models/PendingUser");
const User = require("../models/User");
const mongoose = require("mongoose");

const pendingUserSchema = new mongoose.Schema(
    {
        name: {
            type: String,
            required: true,
            trim: true,
            minlength: 3
        },

        email: {
            type: String,
            required: true,
            lowercase: true,
            trim: true
        },

        password: {
            type: String,
            required: true
        },

        otp: {
            type: String,
            required: true
        },

        otpExpires: {
            type: Date,
            required: true
        }
    },
    {
        timestamps: true
    }
);

pendingUserSchema.index(
    { otpExpires: 1 },
    { expireAfterSeconds: 0 }
);

module.exports = mongoose.model("PendingUser", pendingUserSchema);