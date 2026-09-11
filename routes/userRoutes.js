const express = require("express");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const User = require("../models/User");
const dbConnect = require("../models/dbConnect");
const { protect, adminOnly } = require("../middleware/authMiddleware");
const sendOTP = require("../middleware/utils/sendEmail");


const router = express.Router();

router.get("/register", (req, res) => {
    res.render("register");
});


router.post("/register", async (req, res) => {
    try {
        await dbConnect();

        const { name, email, password } = req.body;

        // Required fields
        if (!name || !email || !password) {
            return res.status(400).json({
                message: "Name, email and password are required"
            });
        }

     
        if (name.trim().length < 3) {
            return res.status(400).json({
                message: "Name must be at least 3 characters"
            });
        }

  
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

        if (!emailRegex.test(email)) {
            return res.status(400).json({
                message: "Invalid email format"
            });
        }

       
        if (password.length < 8) {
            return res.status(400).json({
                message: "Password must be at least 8 characters"
            });
        }

        const normalizedEmail = email.toLowerCase().trim();


        const userExists = await User.findOne({
            email: normalizedEmail
        });

        if (userExists) {
            return res.status(400).json({
                message: "User already exists"
            });
        }

  
        const hashedPassword = await bcrypt.hash(password, 10);

      
        const otp = Math.floor(
            100000 + Math.random() * 900000
        ).toString();

        const otpExpires = new Date(
            Date.now() + 10 * 60 * 1000
        );

  const user = await User.create({
    name: name.trim(),
    email: normalizedEmail,
    password: hashedPassword,
    otp,
    otpExpires,
    isVerified: false
});

try {
    await sendOTP(normalizedEmail, otp);
} catch (emailError) {
    console.error("OTP Email Error:", emailError);

    await User.deleteOne({
        _id: user._id
    });

    return res.status(500).json({
        message: "Unable to send OTP. Account was not created."
    });
}

return res.status(201).json({
    message: "OTP sent to your email. Please verify your email."
});

    } catch (error) {
        console.error("Register Error:", error);

        res.status(500).json({
            message: "Server error"
        });
    }
});



router.post("/verify-otp", async (req, res) => {
    try {
        await dbConnect();

        const { email, otp } = req.body;

        if (!email || !otp) {
            return res.status(400).json({
                message: "Email and OTP are required"
            });
        }

        const normalizedEmail = email.toLowerCase().trim();

        const user = await User.findOne({
            email: normalizedEmail
        });

        if (!user) {
            return res.status(404).json({
                message: "User not found"
            });
        }

        if (user.isVerified) {
            return res.status(400).json({
                message: "Email already verified"
            });
        }

        if (!user.otp || !user.otpExpires) {
            return res.status(400).json({
                message: "OTP not found"
            });
        }

        if (user.otpExpires < new Date()) {
            return res.status(400).json({
                message: "OTP has expired"
            });
        }

    
        if (user.otp !== otp.toString()) {
            return res.status(400).json({
                message: "Invalid OTP"
            });
        }

        user.isVerified = true;
        user.otp = null;
        user.otpExpires = null;

        await user.save();

        res.json({
            message: "Email verified successfully. You can now login."
        });

    } catch (error) {
        console.error("OTP Verification Error:", error);

        res.status(500).json({
            message: "Server error"
        });
    }
});



router.post("/login", async (req, res) => {
    try {
        await dbConnect();

        const { email, password } = req.body;

        if (!email || !password) {
            return res.status(400).json({
                message: "Email and password are required"
            });
        }

        const normalizedEmail = email.toLowerCase().trim();

        const user = await User.findOne({
            email: normalizedEmail
        });

        if (!user) {
            return res.status(400).json({
                message: "Invalid email or password"
            });
        }

        if (!user.isVerified) {
            return res.status(403).json({
                message: "Please verify your email before login"
            });
        }

   
        const isMatch = await bcrypt.compare(
            password,
            user.password
        );

        if (!isMatch) {
            return res.status(400).json({
                message: "Invalid email or password"
            });
        }

   
        const token = jwt.sign(
            {
                id: user._id,
                role: user.role
            },
            process.env.JWT_SECRET,
            {
                expiresIn: "1d"
            }
        );

        res.json({
            token,
            user: {
                id: user._id,
                name: user.name,
                email: user.email,
                role: user.role
            }
        });

    } catch (error) {
        console.error("Login Error:", error);

        res.status(500).json({
            message: "Server error"
        });
    }
});


router.get("/profile", protect, async (req, res) => {
    try {
        await dbConnect();

        const user = await User.findById(req.user.id)
            .select("-password -otp -otpExpires");

        res.json(user);

    } catch (error) {
        console.error("Profile Error:", error);

        res.status(500).json({
            message: "Server error"
        });
    }
});


router.get("/admin", protect, adminOnly, (req, res) => {
    res.json({
        message: "Welcome Admin"
    });
});


module.exports = router;