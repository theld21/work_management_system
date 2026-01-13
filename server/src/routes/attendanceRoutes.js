const express = require("express");
const { check } = require("express-validator");
const attendanceController = require("../controllers/attendanceController");
const { auth, authorize } = require("../middlewares/auth");

const router = express.Router();

// Check in
router.post(
  "/check-in",
  auth,
  [check("note").optional()],
  attendanceController.checkIn
);

// Check out
router.post(
  "/check-out",
  auth,
  [check("note").optional()],
  attendanceController.checkOut
);

// Get current user's attendance
router.get("/my", auth, attendanceController.getUserAttendance);

// Get any user's attendance (admin only)
router.get(
  "/admin-view",
  auth,
  authorize("admin"),
  attendanceController.getAdminUserAttendance
);

// Get today's attendance for current user
router.get("/today", auth, attendanceController.getTodayAttendance);

// Get team attendance (for managers)
router.get(
  "/team",
  auth,
  authorize("admin", "manager"),
  attendanceController.getTeamAttendance
);

// Get attendance report for export (admin only)
router.get(
  "/report",
  auth,
  authorize("admin"),
  attendanceController.getAttendanceReport
);



module.exports = router;
