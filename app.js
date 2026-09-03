const express = require("express");
const mongoose = require("mongoose");
const path = require("path");
const dotenv = require("dotenv");
const cors = require("cors");

// Load Env
dotenv.config();

const app = express();

// Middlewares
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cors());

// View Engine
app.set("view engine", "ejs");
app.set("views", path.join(__dirname, "views"));

// MongoDB Connect - Buffering Error Fix
const connectDB = async () => {
    try {

        console.log("✅ MongoDB Connected Successfully");
    } catch (error) {
        console.error("❌ MongoDB Connection Failed:", error.message);
        process.exit(1);
    }
};

connectDB();

// Routes
app.use("/api/users", require("./routes/userRoutes"));

// Test Route
app.get("/", (req, res) => {
    res.send("User system backend is running");
});

// Server
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
    console.log(`🚀 Server running on port ${PORT}`);
});