
const express = require("express");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");

const User = require("../models/User");
const dbConnect = require("../models/dbConnect");
const { protect, adminOnly } = require("../middleware/authMiddleware");
const sendOTP = require("../middleware/utils/sendEmail");

const router = express.Router();

// Helpers
const normalizeEmail = email => email.toLowerCase().trim();

const generateOTP = () =>
    Math.floor(100000 + Math.random() * 900000).toString();

const getOTPExpiry = () =>
    new Date(Date.now() + 5 * 60 * 1000);

// Register Page
router.get("/register", (req, res) => {
    res.render("register");
});

// Register
router.post("/register", async (req, res) => {
    try {
        await dbConnect();

        const { name, email, password } = req.body;

        if (!name || !email || !password)
            return res.status(400).json({
                success: false,
                message: "Name, email and password are required."
            });

        if (name.trim().length < 3)
            return res.status(400).json({
                success: false,
                message: "Name must contain at least 3 characters."
            });

        if (password.length < 8)
            return res.status(400).json({
                success: false,
                message: "Password must contain at least 8 characters."
            });

        const normalizedEmail = normalizeEmail(email);

        const existingUser = await User.findOne({
            email: normalizedEmail
        });

        if (existingUser)
            return res.status(409).json({
                success: false,
                message: "User already exists."
            });

        const otp = generateOTP();

        const user = await User.create({
            name: name.trim(),
            email: normalizedEmail,
            password: await bcrypt.hash(password, 12),
            otp,
            otpExpires: getOTPExpiry(),
            isVerified: false
        });

        try {
            await sendOTP(normalizedEmail, otp);
        } catch (error) {
            await User.deleteOne({ _id: user._id });

            console.error("OTP Email Error:", error.message);

            return res.status(500).json({
                success: false,
                message: "Unable to send OTP. Please try again."
            });
        }

        res.status(201).json({
            success: true,
            message: "OTP sent successfully. Please verify your email."
        });

    } catch (error) {
        console.error("Register Error:", error.message);

        res.status(500).json({
            success: false,
            message: "Server error. Please try again later."
        });
    }
});

// Verify OTP
router.post("/verify-otp", async (req, res) => {
    try {
        await dbConnect();

        const { email, otp } = req.body;

        if (!email || !otp)
            return res.status(400).json({
                success: false,
                message: "Email and OTP are required."
            });

        const user = await User.findOne({
            email: normalizeEmail(email)
        });

        if (!user)
            return res.status(404).json({
                success: false,
                message: "User not found."
            });

        if (user.isVerified)
            return res.status(409).json({
                success: false,
                message: "Email is already verified."
            });

        if (!user.otp || !user.otpExpires)
            return res.status(400).json({
                success: false,
                message: "OTP is not available."
            });

        if (user.otpExpires < new Date())
            return res.status(400).json({
                success: false,
                message: "OTP has expired."
            });

        if (user.otp !== otp.toString())
            return res.status(400).json({
                success: false,
                message: "Invalid OTP."
            });

        user.isVerified = true;
        user.otp = null;
        user.otpExpires = null;

        await user.save();

        res.json({
            success: true,
            message: "Email verified successfully."
        });

    } catch (error) {
        console.error("OTP Error:", error.message);

        res.status(500).json({
            success: false,
            message: "Unable to verify OTP."
        });
    }
});

// Login Page
router.get("/login", (req, res) => {
    res.render("login");
});

// Login
router.post("/login", async (req, res) => {
    try {
        await dbConnect();

        const { email, password } = req.body;

        if (!email || !password)
            return res.status(400).json({
                success: false,
                message: "Email and password are required."
            });

        const user = await User.findOne({
            email: normalizeEmail(email)
        });

        if (!user)
            return res.status(401).json({
                success: false,
                message: "Invalid email or password."
            });

        if (!user.isVerified)
            return res.status(403).json({
                success: false,
                message: "Please verify your email first."
            });

        const validPassword = await bcrypt.compare(
            password,
            user.password
        );

        if (!validPassword)
            return res.status(401).json({
                success: false,
                message: "Invalid email or password."
            });

        const token = jwt.sign(
            { id: user._id, role: user.role },
            process.env.JWT_SECRET,
            { expiresIn: "1d" }
        );

        res.json({
            success: true,
            message: "Login successful.",
            token,
            user: {
                id: user._id,
                name: user.name,
                email: user.email,
                role: user.role
            }
        });

    } catch (error) {
        console.error("Login Error:", error.message);

        res.status(500).json({
            success: false,
            message: "Unable to login."
        });
    }
});

// Protected Profile
router.get("/profile", protect, async (req, res) => {
    try {
        await dbConnect();

        const user = await User.findById(req.user.id)
            .select("-password -otp -otpExpires");

        if (!user)
            return res.status(404).json({
                success: false,
                message: "User not found."
            });

        res.json({
            success: true,
            user
        });

    } catch (error) {
        console.error("Profile Error:", error.message);

        res.status(500).json({
            success: false,
            message: "Unable to load profile."
        });
    }
});

// Admin
router.get("/admin", protect, adminOnly, (req, res) => {
    res.json({
        success: true,
        message: "Welcome Admin."
    });
});

module.exports = router;
