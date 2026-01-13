const express = require("express");
const cors = require("cors");
require("dotenv").config();

const connectDB = require("./config/db");
const setupAdmin = require("./utils/setupAdmin");
const { scheduleLeaveDaysCron } = require("./utils/cronJobs");
const authRoutes = require("./routes/authRoutes");
const attendanceRoutes = require("./routes/attendanceRoutes");
const requestRoutes = require("./routes/requestRoutes");
const groupRoutes = require("./routes/groupRoutes");
const adminRoutes = require("./routes/adminRoutes");
const deviceTypeRoutes = require("./routes/deviceTypeRoutes");
const deviceRoutes = require("./routes/deviceRoutes");
const contractRoutes = require("./routes/contractRoutes");
const newsRoutes = require("./routes/newsRoutes");

// Initialize app
const app = express();
const PORT = process.env.PORT || 5000;

// Thiết lập múi giờ Việt Nam (UTC+7)
process.env.TZ = "Asia/Ho_Chi_Minh";
console.log(
  `Timezone set to: ${process.env.TZ
  }, Current time: ${new Date().toISOString()}`
);

// Connect to MongoDB
connectDB()
  .then(() => {
    // Initialize cron jobs
    scheduleLeaveDaysCron();
  })
  .catch((err) => {
    console.error("Failed to connect to the database:", err);
  });

// Middleware
app.use(cors());
app.use(express.json());

// Request logging middleware for debugging
app.use((req, res, next) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.url}`);
  console.log("Request body:", req.body);

  // Store original send method
  const originalSend = res.send;

  // Override send method to log response
  res.send = function (body) {
    console.log(
      `[${new Date().toISOString()}] Response to ${req.method} ${req.url}:`,
      typeof body === "string"
        ? body.substring(0, 200)
        : "[Non-string response]"
    );

    // Call original send method
    return originalSend.apply(res, arguments);
  };

  next();
});

// Routes
app.use("/api/auth", authRoutes);
app.use("/api/attendance", attendanceRoutes);
app.use("/api/requests", requestRoutes);
app.use("/api/groups", groupRoutes);
app.use("/api/admin", adminRoutes);
app.use("/api/device-types", deviceTypeRoutes);
app.use("/api/devices", deviceRoutes);
app.use("/api/contracts", contractRoutes);
app.use("/api/news", newsRoutes);

// Health check endpoint
app.get("/health", (req, res) => {
  res.status(200).json({ status: "success", message: "Server is running" });
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({
    message: "Server error",
    error: process.env.NODE_ENV === "development" ? err.message : undefined,
  });
});

// Not found middleware
app.use((req, res) => {
  console.log(
    `[${new Date().toISOString()}] 404 Not Found: ${req.method} ${req.url}`
  );
  res.status(404).json({ message: "Route not found" });
});

// Start server
app.listen(PORT, "0.0.0.0", () => {
  console.log(`Server running on port ${PORT}`);
});
