const nodemailer = require("nodemailer");

const sendOTP = async (email, otp) => {
    const transporter = nodemailer.createTransport({
        host: "smtp.gmail.com",
        port: 465,
        secure: true,

        auth: {
            user: process.env.EMAIL_USER,
            pass: process.env.EMAIL_PASS
        },

        tls: {
            rejectUnauthorized: false
        }
    });

    await transporter.sendMail({
        from: `"User System" <${process.env.EMAIL_USER}>`,
        to: email,
        subject: "Email Verification OTP",
        html: `
            <div style="font-family: Arial, sans-serif;">
                <h2>Email Verification</h2>

                <p>Your OTP is:</p>

                <h1 style="letter-spacing: 5px;">
                    ${otp}
                </h1>

                <p>This OTP will expire in 10 minutes.</p>

                <p>If you did not request this, please ignore this email.</p>
            </div>
        `
    });
};

module.exports = sendOTP;