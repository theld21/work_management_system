const { addMonthlyLeaveDays } = require("./cronJobs");
const mongoose = require("mongoose");
require("dotenv").config({ path: "../../.env" }); // Adjust path to .env if running from src/utils

// Kết nối database và chạy hàm cộng ngày phép
async function testAddLeaveDays() {
    try {
        // Check if MONGODB_URI is loaded, if not try to load from default or parent .env
        const mongoURI = process.env.MONGODB_URI || "mongodb://localhost:27017/fullstack-app";

        await mongoose.connect(mongoURI);
        console.log("Connected to MongoDB");

        await addMonthlyLeaveDays();
        console.log("Successfully added leave days");

        process.exit(0);
    } catch (error) {
        console.error("Error:", error);
        process.exit(1);
    }
}

testAddLeaveDays();
