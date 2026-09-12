const express = require("express");
const router = express.Router();
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");

const User = require("../models/User");
const dbConnect = require("../models/dbConnect");
const { protect, adminOnly } = require("../middleware/authMiddleware");
const sendOTP = require("../middleware/utils/sendEmail");

// Helpers को बिल्कुल clean और optimized रखा है
const normalizeEmail = (email) => email.toLowerCase().trim();
const generateOTP = () => Math.floor(100000 + Math.random() * 900000).toString(); // 6-Digit OTP
const getOTPExpiry = () => new Date(Date.now() + 5 * 60 * 1000); // 5 Mins Valid

// 1. GET: Render Register Page
router.get("/register", (req, res) => {
    res.render("register");
});

// 2. POST: Handle Registration & Send OTP
router.post("/register", async (req, res) => {
    try {
        await dbConnect();

        const { username, name, email, password } = req.body;
        const userName = username || name;

        // Validations
        if (!userName || !email || !password) {
            return res.status(400).json({ success: false, message: "Username, email and password are required." });
        }
        if (userName.trim().length < 3) {
            return res.status(400).json({ success: false, message: "Username must contain at least 3 characters." });
        }
        if (password.length < 8) {
            return res.status(400).json({ success: false, message: "Password must contain at least 8 characters." });
        }

        const normalizedEmail = normalizeEmail(email);
        const existingUser = await User.findOne({ email: normalizedEmail });

        if (existingUser) {
            return res.status(409).json({ success: false, message: "User already exists." });
        }

        const otp = generateOTP();
        const hashedPassword = await bcrypt.hash(password, 12);

        // Temp user create ho rha hai jo verify hone par true hoga
        const user = await User.create({
            name: userName.trim(),
            email: normalizedEmail,
            password: hashedPassword,
            otp: otp,
            otpExpires: getOTPExpiry(),
            isVerified: false
        });

        // Vercel Serverless environment me Email validation handle block
        try {
            // tight integration secure karne ke liye handle await kiya hai
            await sendOTP(normalizedEmail, otp);
            
            return res.status(201).json({
                success: true,
                message: "OTP sent successfully. Please verify your email."
            });
        } catch (emailError) {
            // Email system crash hone par temporary user rollback database cleanup
            await User.deleteOne({ _id: user._id });
            console.error("OTP Email Transport Error:", emailError.message);
            
            return res.status(500).json({
                success: false,
                message: "Unable to send OTP. Please check email configurations or try again."
            });
        }

    } catch (error) {
        console.error("Register Main Error:", error);
        return res.status(500).json({ success: false, message: "Server error. Please try again later." });
    }
});

// 3. POST: Verify OTP Block
router.post("/verify-otp", async (req, res) => {
    try {
        await dbConnect();
        const { email, otp } = req.body;

        if (!email || !otp) {
            return res.status(400).json({ success: false, message: "Email and OTP are required." });
        }

        const normalizedEmail = normalizeEmail(email);
        const user = await User.findOne({ email: normalizedEmail });

        if (!user) return res.status(404).json({ success: false, message: "User not found." });
        if (user.isVerified) return res.status(409).json({ success: false, message: "Email is already verified." });
        if (!user.otp || !user.otpExpires) return res.status(400).json({ success: false, message: "OTP is not available. Please request a new OTP." });
        if (user.otpExpires < new Date()) return res.status(400).json({ success: false, message: "OTP has expired. Please request a new OTP." });

        // String checks standard dynamic inputs se comparison clear rakhne ke liye
        if (String(user.otp).trim() !== String(otp).trim()) {
            return res.status(400).json({ success: false, message: "Invalid OTP." });
        }

        // Cleanup configuration verification safe
        user.isVerified = true;
        user.otp = null;
        user.otpExpires = null;
        await user.save();

        return res.status(200).json({
            success: true,
            message: "Email verified successfully.",
            redirect: "/api/users/login"
        });

    } catch (error) {
        console.error("OTP Verification Error:", error);
        return res.status(500).json({ success: false, message: "Unable to verify OTP. Please try again." });
    }
});

// 4. POST: Resend OTP Block
router.post("/resend-otp", async (req, res) => {
    try {
        await dbConnect();
        const { email } = req.body;

        if (!email) return res.status(400).json({ success: false, message: "Email is required." });

        const normalizedEmail = normalizeEmail(email);
        const user = await User.findOne({ email: normalizedEmail });

        if (!user) return res.status(404).json({ success: false, message: "User not found." });
        if (user.isVerified) return res.status(409).json({ success: false, message: "Email is already verified." });

        const otp = generateOTP();
        user.otp = otp;
        user.otpExpires = getOTPExpiry();
        await user.save();

        // Resend callback handles tight await binding
        await sendOTP(normalizedEmail, otp);

        return res.status(200).json({
            success: true,
            message: "New OTP sent successfully."
        });

    } catch (error) {
        console.error("Resend OTP Error:", error);
        return res.status(500).json({ success: false, message: "Unable to resend OTP." });
    }
});

// 5. GET/POST: Login Section
router.get("/login", (req, res) => {
    res.render("login");
});

router.post("/login", async (req, res) => {
    try {
        await dbConnect();
        const { email, password } = req.body;

        if (!email || !password) {
            return res.status(400).json({ success: false, message: "Email and password are required." });
        }

        const normalizedEmail = normalizeEmail(email);
        const user = await User.findOne({ email: normalizedEmail });

        if (!user) return res.status(401).json({ success: false, message: "Invalid email or password." });
        if (!user.isVerified) return res.status(403).json({ success: false, message: "Please verify your email first." });

        const validPassword = await bcrypt.compare(password, user.password);
        if (!validPassword) return res.status(401).json({ success: false, message: "Invalid email or password." });

        if (!process.env.JWT_SECRET) {
            console.error("JWT_SECRET is missing.");
            return res.status(500).json({ success: false, message: "JWT configuration is missing." });
        }

        const token = jwt.sign(
            { id: user._id, role: user.role },
            process.env.JWT_SECRET,
            { expiresIn: "1d" }
        );

        return res.status(200).json({
            success: true,
            message: "Login successful.",
            token: token,
            user: { id: user._id, name: user.name, email: user.email, role: user.role }
        });

    } catch (error) {
        console.error("Login Error:", error);
        return res.status(500).json({ success: false, message: "Unable to login." });
    }
});

// 6. GET: Profile Configuration Routes
router.get("/profile", protect, async (req, res) => {
    try {
        await dbConnect();
        const user = await User.findById(req.user.id).select("-password -otp -otpExpires");

        if (!user) return res.status(404).json({ success: false, message: "User not found." });

        return res.status(200).json({ success: true, user: user });
    } catch (error) {
        console.error("Profile Error:", error);
        return res.status(500).json({ success: false, message: "Unable to load profile." });
    }
});

// 7. GET: Admin Panel Layout
router.get("/admin", protect, adminOnly, (req, res) => {
    return res.status(200).json({ success: true, message: "Welcome Admin." });
});

module.exports = router;