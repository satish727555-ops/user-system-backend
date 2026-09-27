const express = require("express");
const router = express.Router();

const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");

const User = require("../models/User");
const dbConnect = require("../models/dbConnect");
const {
    protect,
    adminOnly
} = require("../middleware/authMiddleware");

const sendOTP = require("../middleware/utils/sendEmail");


/* =====================================================
   HELPERS
===================================================== */

const normalizeEmail = (email) => {
    return String(email).toLowerCase().trim();
};


const generateOTP = () => {
    return Math.floor(
        100000 + Math.random() * 900000
    ).toString();
};


const otpExpiry = () => {
    return new Date(
        Date.now() + 5 * 60 * 1000
    );
};


const generateStudentId = () => {
    return `BCA-${Date.now()}`;
};


const errorResponse = (
    res,
    status,
    message
) => {
    return res.status(status).json({
        success: false,
        message
    });
};


/* =====================================================
   REGISTER PAGE
===================================================== */

router.get("/register", (req, res) => {

    res.render("register");

});


/* =====================================================
   REGISTER STUDENT
===================================================== */

router.post("/register", async (req, res) => {

    try {

        await dbConnect();

        const {
            username,
            name,
            email,
            password,

            studentId,
            rollNo,
            phone,
            semester,
            course,
            college,
            university,
            dateOfBirth,
            address

        } = req.body;


        /* ================= NAME ================= */

        const studentName =
            (username || name || "").trim();


        /* ================= EMAIL ================= */

        const normalizedEmail =
            email
                ? normalizeEmail(email)
                : "";


        /* ================= BASIC VALIDATION ================= */

        if (
            !studentName ||
            !normalizedEmail ||
            !password
        ) {

            return errorResponse(
                res,
                400,
                "Name, email and password are required."
            );

        }


        if (studentName.length < 3) {

            return errorResponse(
                res,
                400,
                "Name must contain at least 3 characters."
            );

        }


        if (password.length < 8) {

            return errorResponse(
                res,
                400,
                "Password must contain at least 8 characters."
            );

        }


        /* ================= STUDENT DETAILS ================= */

        if (
            !rollNo ||
            !phone ||
            !semester ||
            !college ||
            !university
        ) {

            return errorResponse(
                res,
                400,
                "Please provide all required BCA student details."
            );

        }


        const cleanRollNo =
            String(rollNo)
                .trim()
                .toUpperCase();


        const cleanPhone =
            String(phone).trim();


        const semesterNumber =
            Number(semester);


        /* ================= PHONE VALIDATION ================= */

        if (!/^[6-9]\d{9}$/.test(cleanPhone)) {

            return errorResponse(
                res,
                400,
                "Please enter a valid 10-digit Indian mobile number."
            );

        }


        /* ================= SEMESTER VALIDATION ================= */

        if (
            Number.isNaN(semesterNumber) ||
            semesterNumber < 1 ||
            semesterNumber > 6
        ) {

            return errorResponse(
                res,
                400,
                "Semester must be between 1 and 6."
            );

        }


        /* ================= EMAIL DUPLICATE ================= */

        const existingEmail =
            await User.findOne({
                email: normalizedEmail
            });


        if (existingEmail) {

            return errorResponse(
                res,
                409,
                "Email is already registered."
            );

        }


        /* ================= ROLL NUMBER DUPLICATE ================= */

        const existingRollNo =
            await User.findOne({
                rollNo: cleanRollNo
            });


        if (existingRollNo) {

            return errorResponse(
                res,
                409,
                "Roll number is already registered."
            );

        }


        /* ================= STUDENT ID ================= */

        const finalStudentId =
            studentId
                ? String(studentId)
                    .trim()
                    .toUpperCase()
                : generateStudentId();


        /* ================= STUDENT ID DUPLICATE ================= */

        const existingStudentId =
            await User.findOne({
                studentId: finalStudentId
            });


        if (existingStudentId) {

            return errorResponse(
                res,
                409,
                "Student ID is already registered."
            );

        }


        /* ================= OTP ================= */

        const otp = generateOTP();


        /* ================= CREATE STUDENT ================= */

        const user =
            await User.create({

                studentId:
                    finalStudentId,

                name:
                    studentName,

                email:
                    normalizedEmail,

                password:
                    await bcrypt.hash(
                        password,
                        12
                    ),

                phone:
                    cleanPhone,

                rollNo:
                    cleanRollNo,

                semester:
                    semesterNumber,

                course:
                    course
                        ? String(course).trim()
                        : "BCA",

                college:
                    String(college).trim(),

                university:
                    String(university).trim(),

                dateOfBirth:
                    dateOfBirth
                        ? new Date(dateOfBirth)
                        : null,

                address:
                    address
                        ? String(address).trim()
                        : "",

                role:
                    "user",

                isVerified:
                    false,

                otp,

                otpExpires:
                    otpExpiry()

            });


        /* ================= SEND OTP ================= */

        try {

            await sendOTP(
                normalizedEmail,
                otp
            );

        } catch (emailError) {

            await User.deleteOne({
                _id: user._id
            });

            console.error(
                "OTP Email Error:",
                emailError.message
            );

            return errorResponse(
                res,
                500,
                "Unable to send OTP. Please try again."
            );

        }


        /* ================= SUCCESS ================= */

        return res.status(201).json({

            success: true,

            message:
                "Student registered successfully. OTP sent to your email.",

            studentId:
                user.studentId

        });


    } catch (error) {

        console.error(
            "Register Error:",
            error
        );

        return errorResponse(
            res,
            500,
            "Server error. Please try again later."
        );

    }

});


/* =====================================================
   VERIFY OTP
===================================================== */

router.post(
    "/verify-otp",
    async (req, res) => {

        try {

            await dbConnect();

            const {
                email,
                otp
            } = req.body;


            if (!email || !otp) {

                return errorResponse(
                    res,
                    400,
                    "Email and OTP are required."
                );

            }


            const user =
                await User.findOne({

                    email:
                        normalizeEmail(email)

                });


            if (!user) {

                return errorResponse(
                    res,
                    404,
                    "Student not found."
                );

            }


            if (user.isVerified) {

                return errorResponse(
                    res,
                    409,
                    "Email is already verified."
                );

            }


            if (
                !user.otp ||
                !user.otpExpires
            ) {

                return errorResponse(
                    res,
                    400,
                    "OTP is not available. Please request a new OTP."
                );

            }


            if (
                user.otpExpires < new Date()
            ) {

                return errorResponse(
                    res,
                    400,
                    "OTP has expired. Please request a new OTP."
                );

            }


            if (
                String(user.otp) !==
                String(otp).trim()
            ) {

                return errorResponse(
                    res,
                    400,
                    "Invalid OTP."
                );

            }


            /* ================= VERIFY ================= */

            user.isVerified = true;

            user.otp = null;

            user.otpExpires = null;


            await user.save();


            return res.status(200).json({

                success: true,

                message:
                    "Email verified successfully.",

                student: {

                    studentId:
                        user.studentId,

                    name:
                        user.name,

                    email:
                        user.email,

                    rollNo:
                        user.rollNo,

                    semester:
                        user.semester,

                    course:
                        user.course

                },

                redirect:
                    "/api/users/login"

            });


        } catch (error) {

            console.error(
                "OTP Verification Error:",
                error
            );

            return errorResponse(
                res,
                500,
                "Unable to verify OTP. Please try again."
            );

        }

    }
);


/* =====================================================
   RESEND OTP
===================================================== */

router.post(
    "/resend-otp",
    async (req, res) => {

        try {

            await dbConnect();

            const {
                email
            } = req.body;


            if (!email) {

                return errorResponse(
                    res,
                    400,
                    "Email is required."
                );

            }


            const normalizedEmail =
                normalizeEmail(email);


            const user =
                await User.findOne({

                    email:
                        normalizedEmail

                });


            if (!user) {

                return errorResponse(
                    res,
                    404,
                    "Student not found."
                );

            }


            if (user.isVerified) {

                return errorResponse(
                    res,
                    409,
                    "Email is already verified."
                );

            }


            const otp =
                generateOTP();


            user.otp =
                otp;

            user.otpExpires =
                otpExpiry();


            await user.save();


            await sendOTP(
                normalizedEmail,
                otp
            );


            return res.status(200).json({

                success: true,

                message:
                    "New OTP sent successfully."

            });


        } catch (error) {

            console.error(
                "Resend OTP Error:",
                error
            );

            return errorResponse(
                res,
                500,
                "Unable to resend OTP."
            );

        }

    }
);


/* =====================================================
   LOGIN PAGE
===================================================== */

router.get("/login", (req, res) => {

    res.render("login");

});


/* =====================================================
   LOGIN
===================================================== */

router.post(
    "/login",
    async (req, res) => {

        try {

            await dbConnect();

            const {
                email,
                password
            } = req.body;


            if (!email || !password) {

                return errorResponse(
                    res,
                    400,
                    "Email and password are required."
                );

            }


            const user =
                await User.findOne({

                    email:
                        normalizeEmail(email)

                });


            if (!user) {

                return errorResponse(
                    res,
                    401,
                    "Invalid email or password."
                );

            }


            if (!user.isVerified) {

                return errorResponse(
                    res,
                    403,
                    "Please verify your email first."
                );

            }


            const validPassword =
                await bcrypt.compare(
                    password,
                    user.password
                );


            if (!validPassword) {

                return errorResponse(
                    res,
                    401,
                    "Invalid email or password."
                );

            }


            /* ================= JWT CHECK ================= */

            if (!process.env.JWT_SECRET) {

                console.error(
                    "JWT_SECRET is missing."
                );

                return errorResponse(
                    res,
                    500,
                    "JWT configuration is missing."
                );

            }


            /* ================= CREATE TOKEN ================= */

            const token =
                jwt.sign(

                    {
                        id:
                            user._id,

                        role:
                            user.role

                    },

                    process.env.JWT_SECRET,

                    {
                        expiresIn:
                            "1d"
                    }

                );


            return res.status(200).json({

                success: true,

                message:
                    "Login successful.",

                token,

                user: {

                    id:
                        user._id,

                    studentId:
                        user.studentId,

                    name:
                        user.name,

                    email:
                        user.email,

                    phone:
                        user.phone,

                    rollNo:
                        user.rollNo,

                    semester:
                        user.semester,

                    course:
                        user.course,

                    college:
                        user.college,

                    university:
                        user.university,

                    role:
                        user.role

                }

            });


        } catch (error) {

            console.error(
                "Login Error:",
                error
            );

            return errorResponse(
                res,
                500,
                "Unable to login."
            );

        }

    }
);


/* =====================================================
   PROFILE
===================================================== */

router.get(
    "/profile",
    protect,
    async (req, res) => {

        try {

            await dbConnect();


            const user =
                await User.findById(
                    req.user.id
                ).select(
                    "-password -otp -otpExpires"
                );


            if (!user) {

                return errorResponse(
                    res,
                    404,
                    "Student not found."
                );

            }


            return res.status(200).json({

                success: true,

                user

            });


        } catch (error) {

            console.error(
                "Profile Error:",
                error
            );

            return errorResponse(
                res,
                500,
                "Unable to load student profile."
            );

        }

    }
);


/* =====================================================
   ALL STUDENTS
===================================================== */

router.get(
    "/students",
    protect,
    adminOnly,
    async (req, res) => {

        try {

            await dbConnect();


            const page =
                Math.max(
                    Number(req.query.page) || 1,
                    1
                );


            const limit =
                Math.min(
                    Math.max(
                        Number(
                            req.query.limit
                        ) || 10,
                        1
                    ),
                    100
                );


            const skip =
                (page - 1) * limit;


            /* ================= TOTAL ================= */

            const totalStudents =
                await User.countDocuments({
                    role: "user"
                });


            /* ================= STUDENTS ================= */

            const students =
                await User.find({
                    role: "user"
                })
                    .select(
                        "-password -otp -otpExpires"
                    )
                    .sort({
                        createdAt: -1
                    })
                    .skip(skip)
                    .limit(limit);


            const totalPages =
                Math.ceil(
                    totalStudents / limit
                );


            return res.status(200).json({

                success: true,

                pagination: {

                    currentPage:
                        page,

                    limit:
                        limit,

                    totalStudents:
                        totalStudents,

                    totalPages:
                        totalPages,

                    hasNextPage:
                        page < totalPages,

                    hasPreviousPage:
                        page > 1

                },

                students

            });


        } catch (error) {

            console.error(
                "Get Students Error:",
                error
            );

            return errorResponse(
                res,
                500,
                "Unable to load students."
            );

        }

    }
);


/* =====================================================
   STUDENT SEARCH / LOOKUP
===================================================== */

router.get(
    "/students/search",
    protect,
    adminOnly,
    async (req, res) => {

        try {

            await dbConnect();


            const {
                studentId,
                rollNo,
                name,
                email,
                phone,
                semester
            } = req.query;


            const query = {};


            /* ================= STUDENT ID ================= */

            if (studentId) {

                query.studentId =
                    studentId
                        .trim()
                        .toUpperCase();

            }


            /* ================= ROLL NUMBER ================= */

            if (rollNo) {

                query.rollNo =
                    rollNo
                        .trim()
                        .toUpperCase();

            }


            /* ================= NAME ================= */

            if (name) {

                query.name = {

                    $regex:
                        name.trim(),

                    $options:
                        "i"

                };

            }


            /* ================= EMAIL ================= */

            if (email) {

                query.email =
                    email
                        .trim()
                        .toLowerCase();

            }


            /* ================= PHONE ================= */

            if (phone) {

                query.phone =
                    phone.trim();

            }


            /* ================= SEMESTER ================= */

            if (semester) {

                const semesterNumber =
                    Number(semester);


                if (
                    Number.isNaN(
                        semesterNumber
                    ) ||
                    semesterNumber < 1 ||
                    semesterNumber > 6
                ) {

                    return errorResponse(
                        res,
                        400,
                        "Semester must be between 1 and 6."
                    );

                }


                query.semester =
                    semesterNumber;

            }


            /* ================= NO QUERY ================= */

            if (
                Object.keys(query).length === 0
            ) {

                return errorResponse(
                    res,
                    400,
                    "Please provide a search parameter."
                );

            }


            /* ================= SEARCH ================= */

            const students =
                await User.find(query)
                    .select(
                        "-password -otp -otpExpires"
                    )
                    .sort({
                        createdAt: -1
                    });


            return res.status(200).json({

                success: true,

                count:
                    students.length,

                students

            });


        } catch (error) {

            console.error(
                "Student Search Error:",
                error
            );

            return errorResponse(
                res,
                500,
                "Unable to search students."
            );

        }

    }
);


/* =====================================================
   UPDATE STUDENT
===================================================== */

router.put(
    "/students/:id",
    protect,
    adminOnly,
    async (req, res) => {

        try {

            await dbConnect();


            const {
                name,
                phone,
                rollNo,
                semester,
                course,
                college,
                university,
                dateOfBirth,
                address
            } = req.body;


            const student =
                await User.findById(
                    req.params.id
                );


            if (!student) {

                return errorResponse(
                    res,
                    404,
                    "Student not found."
                );

            }


            /* ================= NAME ================= */

            if (name !== undefined) {

                const cleanName =
                    String(name).trim();


                if (cleanName.length < 3) {

                    return errorResponse(
                        res,
                        400,
                        "Name must contain at least 3 characters."
                    );

                }

                student.name =
                    cleanName;

            }


            /* ================= PHONE ================= */

            if (phone !== undefined) {

                const cleanPhone =
                    String(phone).trim();


                if (
                    !/^[6-9]\d{9}$/.test(
                        cleanPhone
                    )
                ) {

                    return errorResponse(
                        res,
                        400,
                        "Please enter a valid 10-digit Indian mobile number."
                    );

                }


                student.phone =
                    cleanPhone;

            }


            /* ================= ROLL NUMBER ================= */

            if (rollNo !== undefined) {

                const cleanRollNo =
                    String(rollNo)
                        .trim()
                        .toUpperCase();


                const duplicateRoll =
                    await User.findOne({

                        rollNo:
                            cleanRollNo,

                        _id: {
                            $ne:
                                student._id
                        }

                    });


                if (duplicateRoll) {

                    return errorResponse(
                        res,
                        409,
                        "Roll number is already used by another student."
                    );

                }


                student.rollNo =
                    cleanRollNo;

            }


            /* ================= SEMESTER ================= */

            if (semester !== undefined) {

                const semesterNumber =
                    Number(semester);


                if (
                    Number.isNaN(
                        semesterNumber
                    ) ||
                    semesterNumber < 1 ||
                    semesterNumber > 6
                ) {

                    return errorResponse(
                        res,
                        400,
                        "Semester must be between 1 and 6."
                    );

                }


                student.semester =
                    semesterNumber;

            }


            /* ================= COURSE ================= */

            if (course !== undefined) {

                student.course =
                    String(course).trim();

            }


            /* ================= COLLEGE ================= */

            if (college !== undefined) {

                student.college =
                    String(college).trim();

            }


            /* ================= UNIVERSITY ================= */

            if (university !== undefined) {

                student.university =
                    String(university).trim();

            }


            /* ================= DATE OF BIRTH ================= */

            if (dateOfBirth !== undefined) {

                student.dateOfBirth =
                    dateOfBirth
                        ? new Date(dateOfBirth)
                        : null;

            }


            /* ================= ADDRESS ================= */

            if (address !== undefined) {

                student.address =
                    String(address).trim();

            }


            await student.save();


            return res.status(200).json({

                success: true,

                message:
                    "Student updated successfully.",

                student:
                    await User.findById(
                        student._id
                    ).select(
                        "-password -otp -otpExpires"
                    )

            });


        } catch (error) {

            console.error(
                "Update Student Error:",
                error
            );

            return errorResponse(
                res,
                500,
                "Unable to update student."
            );

        }

    }
);


/* =====================================================
   DELETE STUDENT
===================================================== */

router.delete(
    "/students/:id",
    protect,
    adminOnly,
    async (req, res) => {

        try {

            await dbConnect();


            const student =
                await User.findById(
                    req.params.id
                );


            if (!student) {

                return errorResponse(
                    res,
                    404,
                    "Student not found."
                );

            }


            await User.deleteOne({
                _id:
                    req.params.id
            });


            return res.status(200).json({

                success: true,

                message:
                    "Student deleted successfully."

            });


        } catch (error) {

            console.error(
                "Delete Student Error:",
                error
            );

            return errorResponse(
                res,
                500,
                "Unable to delete student."
            );

        }

    }
);


/* =====================================================
   ADMIN TEST
===================================================== */

router.get(
    "/admin",
    protect,
    adminOnly,
    (req, res) => {

        return res.status(200).json({

            success: true,

            message:
                "Welcome Admin."

        });

    }
);


/* =====================================================
   EXPORT
===================================================== */

module.exports = router;