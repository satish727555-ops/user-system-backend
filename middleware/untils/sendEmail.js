const nodemailer = require("nodemailer");

const transporter = nodemailer.createTransport({
    service: "gmail",
    auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS,
    },
});

const sendOTP = async (email, otp) => {
    await transporter.sendMail({
        from: process.env.EMAIL_USER,
        to: email,
        subject: "Your OTP - User System",
        html: `
            <div style="font-family: Arial, sans-serif;">
                <h2>Email Verification</h2>
                <p>Your OTP is:</p>
                <h1 style="letter-spacing: 5px;">${otp}</h1>
                <p>This OTP will expire in 10 minutes.</p>
            </div>
        `,
    });
};

module.exports = sendOTP;