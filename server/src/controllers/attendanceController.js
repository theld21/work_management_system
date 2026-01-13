const { validationResult } = require("express-validator");
const Attendance = require("../models/Attendance");
const Request = require("../models/Request");



const getClientIP = (req) => {
  const ip = req.headers["x-forwarded-for"]?.split(",")[0]?.trim() ||
    req.socket.remoteAddress ||
    req.ip ||
    "";
  if (ip.startsWith("::ffff:")) return ip.substring(7);
  return ip;
};

/**
 * Hàm hỗ trợ để lấy ngày bắt đầu và kết thúc của một ngày từ checkIn time
 * @param {Date} date - Ngày cần xử lý
 * @returns {Object} - Đối tượng chứa startOfDay và endOfDay
 */
const getDayBoundaries = (date = new Date()) => {
  const startOfDay = new Date(date);
  startOfDay.setHours(0, 0, 0, 0);

  const endOfDay = new Date(date);
  endOfDay.setHours(23, 59, 59, 999);

  return { startOfDay, endOfDay };
};

// Check in
exports.checkIn = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    // Check IP
    const allowedIP = process.env.ALLOWED_IP;
    if (allowedIP) {
      const clientIP = getClientIP(req);
      if (clientIP !== allowedIP) {
        return res.status(403).json({
          message: "Không thể chấm công từ vị trí này",
          details: "IP hiện tại không khớp với IP công ty",
          clientIP: clientIP,
        });
      }
    }



    const userId = req.user.id;
    const now = new Date();
    const { startOfDay, endOfDay } = getDayBoundaries(now);

    // Check if user already checked in today using checkIn field
    const attendance = await Attendance.findOne({
      user: userId,
      checkIn: {
        $gte: startOfDay,
        $lte: endOfDay,
      },
    });

    if (attendance) {
      return res.status(400).json({ message: "Bạn đã điểm danh hôm nay" });
    }

    // Create new attendance record with IP info
    const newAttendance = new Attendance({
      user: userId,
      checkIn: now,
    });

    await newAttendance.save();

    // Log successful check-in with IP info
    console.log(
      `[CHECK-IN SUCCESS] User: ${req.user.id}, Time: ${now.toISOString()}`
    );

    res.status(201).json(newAttendance);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Lỗi máy chủ" });
  }
};

// Check out
exports.checkOut = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }



    // Check IP
    const allowedIP = process.env.ALLOWED_IP;
    if (allowedIP) {
      const clientIP = getClientIP(req);
      if (clientIP !== allowedIP) {
        return res.status(403).json({
          message: "Không thể chấm công từ vị trí này",
          details: "IP hiện tại không khớp với IP công ty",
          clientIP: clientIP,
        });
      }
    }

    const userId = req.user.id;
    const now = new Date();
    const { startOfDay, endOfDay } = getDayBoundaries(now);

    // Find today's attendance record using checkIn field
    const attendance = await Attendance.findOne({
      user: userId,
      checkIn: {
        $gte: startOfDay,
        $lte: endOfDay,
      },
    });

    if (!attendance) {
      return res.status(400).json({ message: "Bạn cần điểm danh trước" });
    }

    if (attendance.checkOut) {
      return res.status(400).json({ message: "Bạn đã kết thúc hôm nay" });
    }

    // Update checkout time
    attendance.checkOut = now;
    await attendance.save();

    // Log successful check-out with IP info
    console.log(
      `[CHECK-OUT SUCCESS] User: ${req.user.id}, Time: ${now.toISOString()}`
    );

    res.json(attendance);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Lỗi máy chủ" });
  }
};

// Get attendance for current user
exports.getUserAttendance = async (req, res) => {
  try {
    const { startDate, endDate } = req.query;
    const userId = req.user.id;

    let attendanceQuery = { user: userId };
    let requestQuery = {
      user: userId,
      type: "leave-request",
      status: 3,
    };

    if (startDate && endDate) {
      const { startOfDay: start } = getDayBoundaries(new Date(startDate));
      const { endOfDay: end } = getDayBoundaries(new Date(endDate));

      // Query using checkIn field instead of date
      attendanceQuery.checkIn = {
        $gte: start,
        $lte: end,
      };

      // For requests, check if startTime or endTime falls within the date range
      requestQuery.$or = [
        {
          startTime: {
            $gte: start,
            $lte: end,
          },
        },
        {
          endTime: {
            $gte: start,
            $lte: end,
          },
        },
        {
          $and: [{ startTime: { $lte: start } }, { endTime: { $gte: end } }],
        },
      ];
    }

    const [attendance, requests] = await Promise.all([
      Attendance.find(attendanceQuery).sort({ checkIn: -1 }),
      Request.find(requestQuery)
        .populate("user", "name email")
        .sort({ startTime: -1 }),
    ]);

    res.json({
      attendance,
      requests,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Lỗi máy chủ", error: error.message });
  }
};

// Get attendance for any user (admin only)
exports.getAdminUserAttendance = async (req, res) => {
  try {
    const { startDate, endDate, userId } = req.query;

    // Verify the user is admin
    if (req.user.role !== "admin") {
      return res.status(403).json({ message: "Không có quyền truy cập" });
    }

    if (!userId) {
      return res.status(400).json({ message: "userId là bắt buộc" });
    }

    let attendanceQuery = { user: userId };
    let requestQuery = {
      user: userId,
      type: "leave-request",
      status: 3,
    };

    if (startDate && endDate) {
      const { startOfDay: start } = getDayBoundaries(new Date(startDate));
      const { endOfDay: end } = getDayBoundaries(new Date(endDate));

      // Query using checkIn field instead of date
      attendanceQuery.checkIn = {
        $gte: start,
        $lte: end,
      };

      // For requests, check if startTime or endTime falls within the date range
      requestQuery.$or = [
        {
          startTime: {
            $gte: start,
            $lte: end,
          },
        },
        {
          endTime: {
            $gte: start,
            $lte: end,
          },
        },
        {
          $and: [{ startTime: { $lte: start } }, { endTime: { $gte: end } }],
        },
      ];
    }

    const [attendance, requests] = await Promise.all([
      Attendance.find(attendanceQuery).sort({ checkIn: -1 }),
      Request.find(requestQuery)
        .populate("user", "name email")
        .sort({ startTime: -1 }),
    ]);

    res.json({
      attendance,
      requests,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Lỗi máy chủ", error: error.message });
  }
};

// Get today's attendance for current user
exports.getTodayAttendance = async (req, res) => {
  try {
    const userId = req.user.id;
    const { startOfDay, endOfDay } = getDayBoundaries();

    // Query using checkIn field instead of date
    const attendance = await Attendance.findOne({
      user: userId,
      checkIn: {
        $gte: startOfDay,
        $lte: endOfDay,
      },
    });

    res.json(attendance || { message: "Không có lịch chấm công" });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Lỗi máy chủ" });
  }
};

// Get attendance report for team (for managers)
exports.getTeamAttendance = async (req, res) => {
  try {
    const { startDate, endDate, groupId } = req.query;

    // Verify the user is a manager
    if (!["admin", "manager"].includes(req.user.role)) {
      return res
        .status(403)
        .json({ message: "Không có quyền truy cập lịch chấm công" });
    }

    let query = {};

    if (startDate && endDate) {
      const { startOfDay: start } = getDayBoundaries(new Date(startDate));
      const { endOfDay: end } = getDayBoundaries(new Date(endDate));

      // Query using checkIn field instead of date
      query.checkIn = {
        $gte: start,
        $lte: end,
      };
    }

    // If group ID is provided, get attendance for that group's members
    if (groupId) {
      const Group = require("../models/Group");
      const group = await Group.findById(groupId);

      if (!group) {
        return res.status(404).json({ message: "bộ phận không tồn tại" });
      }

      query.user = { $in: group.members };
    }

    const attendance = await Attendance.find(query)
      .populate("user", "firstName lastName username email")
      .sort({ checkIn: -1 });

    res.json(attendance);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Lỗi máy chủ" });
  }
};

exports.getAttendanceReport = async (req, res) => {
  try {
    const { month, year } = req.query;

    if (!month || !year) {
      return res.status(400).json({
        message: "Tháng và năm là bắt buộc",
      });
    }

    // Work day constants (matching client constants)
    const WORK_START_HOUR = 8;
    const WORK_START_MINUTE = 30;
    const WORK_END_HOUR = 17;
    const WORK_END_MINUTE = 30;
    const LUNCH_START_HOUR = 12;
    const LUNCH_START_MINUTE = 0;
    const LUNCH_END_HOUR = 13;
    const LUNCH_END_MINUTE = 0;
    const WORK_HOURS_REQUIRED = 8;

    // Helper function to calculate work day ratio from check-in/check-out times
    // Returns work day ratio (0.00 to 1.00) where 1.00 = full 8-hour work day
    const calculateWorkDayRatio = (
      checkIn,
      checkOut,
      leaveHours = 0,
      leaveType = null
    ) => {
      if (!checkIn || !checkOut) return 0;

      const checkInTime = new Date(checkIn);
      const checkOutTime = new Date(checkOut);

      // Define work periods
      const morningStart = new Date(checkInTime);
      morningStart.setHours(WORK_START_HOUR, WORK_START_MINUTE, 0, 0);
      const morningEnd = new Date(checkInTime);
      morningEnd.setHours(LUNCH_START_HOUR, LUNCH_START_MINUTE, 0, 0);
      const afternoonStart = new Date(checkInTime);
      afternoonStart.setHours(LUNCH_END_HOUR, LUNCH_END_MINUTE, 0, 0);
      const afternoonEnd = new Date(checkInTime);
      afternoonEnd.setHours(WORK_END_HOUR, WORK_END_MINUTE, 0, 0);

      let totalWorkMinutes = 0;

      // Logic based on leave type
      if (leaveType === "morning") {
        // Nghỉ sáng: chỉ tính giờ làm buổi chiều
        const effectiveAfternoonStart =
          checkInTime > afternoonStart ? checkInTime : afternoonStart;
        const effectiveAfternoonEnd =
          checkOutTime < afternoonEnd ? checkOutTime : afternoonEnd;

        if (effectiveAfternoonEnd > effectiveAfternoonStart) {
          totalWorkMinutes =
            (effectiveAfternoonEnd - effectiveAfternoonStart) / (1000 * 60);
        }

        // Add leave hours for morning
        totalWorkMinutes += leaveHours * 60;
      } else if (leaveType === "afternoon") {
        // Nghỉ chiều: chỉ tính giờ làm buổi sáng
        const effectiveMorningStart =
          checkInTime > morningStart ? checkInTime : morningStart;
        const effectiveMorningEnd =
          checkOutTime < morningEnd ? checkOutTime : morningEnd;

        if (effectiveMorningEnd > effectiveMorningStart) {
          totalWorkMinutes =
            (effectiveMorningEnd - effectiveMorningStart) / (1000 * 60);
        }

        // Add leave hours for afternoon
        totalWorkMinutes += leaveHours * 60;
      } else {
        // Normal work day calculation
        let workMinutes = 0;

        // Calculate morning work hours
        if (checkInTime < morningEnd && checkOutTime > morningStart) {
          const morningWorkStart =
            checkInTime > morningStart ? checkInTime : morningStart;
          const morningWorkEnd =
            checkOutTime < morningEnd ? checkOutTime : morningEnd;
          workMinutes += (morningWorkEnd - morningWorkStart) / (1000 * 60);
        }

        // Calculate afternoon work hours
        if (checkInTime < afternoonEnd && checkOutTime > afternoonStart) {
          const afternoonWorkStart =
            checkInTime > afternoonStart ? checkInTime : afternoonStart;
          const afternoonWorkEnd =
            checkOutTime < afternoonEnd ? checkOutTime : afternoonEnd;
          workMinutes += (afternoonWorkEnd - afternoonWorkStart) / (1000 * 60);
        }

        totalWorkMinutes = workMinutes + leaveHours * 60;
      }

      // Cap at maximum 8 hours (480 minutes)
      const maxWorkMinutes = WORK_HOURS_REQUIRED * 60; // 480 minutes
      const cappedWorkMinutes = Math.min(
        Math.max(0, totalWorkMinutes),
        maxWorkMinutes
      );

      // Convert to work day ratio: actual minutes / (8 * 60)
      const workDayRatio = cappedWorkMinutes / maxWorkMinutes;

      return workDayRatio;
    };

    // Helper function to calculate leave hours and type for a specific day
    const calculateLeaveHoursForDay = (date, leaveRequests) => {
      let morningLeaveHours = 0;
      let afternoonLeaveHours = 0;

      leaveRequests.forEach((req) => {
        const reqStart = new Date(req.startTime);
        const reqEnd = new Date(req.endTime);
        const dayStart = new Date(date);
        dayStart.setHours(0, 0, 0, 0);
        const dayEnd = new Date(date);
        dayEnd.setHours(23, 59, 59, 999);

        // Check if leave request overlaps with this day
        if (reqEnd >= dayStart && reqStart <= dayEnd) {
          // Calculate overlap period
          const overlapStart = new Date(
            Math.max(reqStart.getTime(), dayStart.getTime())
          );
          const overlapEnd = new Date(
            Math.min(reqEnd.getTime(), dayEnd.getTime())
          );

          // Define work periods (morning: 8:30-12:00, afternoon: 13:00-17:30)
          const morningStart = new Date(date);
          morningStart.setHours(WORK_START_HOUR, WORK_START_MINUTE, 0, 0);
          const morningEnd = new Date(date);
          morningEnd.setHours(LUNCH_START_HOUR, LUNCH_START_MINUTE, 0, 0);
          const afternoonStart = new Date(date);
          afternoonStart.setHours(LUNCH_END_HOUR, LUNCH_END_MINUTE, 0, 0);
          const afternoonEnd = new Date(date);
          afternoonEnd.setHours(WORK_END_HOUR, WORK_END_MINUTE, 0, 0);

          // Calculate leave hours for morning period
          if (overlapEnd > morningStart && overlapStart < morningEnd) {
            const morningLeaveStart = new Date(
              Math.max(overlapStart.getTime(), morningStart.getTime())
            );
            const morningLeaveEnd = new Date(
              Math.min(overlapEnd.getTime(), morningEnd.getTime())
            );
            const morningLeaveMinutes =
              (morningLeaveEnd - morningLeaveStart) / (1000 * 60);
            morningLeaveHours += morningLeaveMinutes / 60;
          }

          // Calculate leave hours for afternoon period
          if (overlapEnd > afternoonStart && overlapStart < afternoonEnd) {
            const afternoonLeaveStart = new Date(
              Math.max(overlapStart.getTime(), afternoonStart.getTime())
            );
            const afternoonLeaveEnd = new Date(
              Math.min(overlapEnd.getTime(), afternoonEnd.getTime())
            );
            const afternoonLeaveMinutes =
              (afternoonLeaveEnd - afternoonLeaveStart) / (1000 * 60);
            afternoonLeaveHours += afternoonLeaveMinutes / 60;
          }
        }
      });

      const totalLeaveHours = morningLeaveHours + afternoonLeaveHours;

      // Determine leave type
      let leaveType = null;
      if (morningLeaveHours > 0 && afternoonLeaveHours === 0) {
        leaveType = "morning";
      } else if (morningLeaveHours === 0 && afternoonLeaveHours > 0) {
        leaveType = "afternoon";
      }
      // If both periods have leave or no leave, leaveType remains null

      return {
        totalLeaveHours,
        morningLeaveHours,
        afternoonLeaveHours,
        leaveType,
      };
    };

    // Tạo khoảng thời gian cho tháng
    const startDate = new Date(year, month - 1, 1); // month is 0-indexed
    const endDate = new Date(year, month, 0, 23, 59, 59, 999); // Last day of month

    // Lấy danh sách tất cả user
    const User = require("../models/User");
    const users = await User.find({ role: { $ne: "admin" } })
      .select("firstName lastName email employeeId")
      .populate("group", "name")
      .sort({ employeeId: 1, firstName: 1 }); // Sort by employeeId first, then firstName

    // Lấy tất cả attendance trong tháng sử dụng checkIn
    const attendances = await Attendance.find({
      checkIn: { $gte: startDate, $lte: endDate },
    }).populate("user", "firstName lastName email employeeId");

    // Lấy tất cả leave requests đã approved trong tháng
    const requests = await Request.find({
      type: "leave-request",
      status: 3, // approved
      $or: [
        {
          startTime: { $gte: startDate, $lte: endDate },
        },
        {
          endTime: { $gte: startDate, $lte: endDate },
        },
        {
          $and: [
            { startTime: { $lte: startDate } },
            { endTime: { $gte: endDate } },
          ],
        },
      ],
    }).populate("user", "firstName lastName email employeeId");

    // Tạo map attendance theo user và ngày (sử dụng checkIn)
    const attendanceMap = new Map();
    attendances.forEach((att) => {
      const userId = att.user._id.toString();
      // Lấy ngày từ checkIn time
      const dateKey = att.checkIn.toISOString().split("T")[0];
      if (!attendanceMap.has(userId)) {
        attendanceMap.set(userId, new Map());
      }
      attendanceMap.get(userId).set(dateKey, att);
    });

    // Tạo map leave requests theo user
    const userLeaveRequestsMap = new Map();
    requests.forEach((req) => {
      const userId = req.user._id.toString();
      if (!userLeaveRequestsMap.has(userId)) {
        userLeaveRequestsMap.set(userId, []);
      }
      userLeaveRequestsMap.get(userId).push(req);
    });

    // Tính toán dữ liệu cho từng user
    const reportData = users.map((user) => {
      const userId = user._id.toString();
      const userAttendances = attendanceMap.get(userId) || new Map();
      const userLeaveRequests = userLeaveRequestsMap.get(userId) || [];

      const dailyData = [];
      let totalWorkDays = 0;

      // Lặp qua từng ngày trong tháng
      const daysInMonth = new Date(year, month, 0).getDate(); // Get total days in month
      for (let day = 1; day <= daysInMonth; day++) {
        // Create UTC date to avoid timezone issues
        const d = new Date(Date.UTC(year, month - 1, day, 12, 0, 0)); // Set to noon UTC
        const dateKey = d.toISOString().split("T")[0];
        const isWorkDay = d.getDay() >= 1 && d.getDay() <= 5; // Mon-Fri

        if (!isWorkDay) {
          dailyData.push({
            date: dateKey,
            day: d.getDate(),
            workDayRatio: 0.0,
            note: "Cuối tuần",
          });
          continue;
        }

        const attendance = userAttendances.get(dateKey);
        const leaveData = calculateLeaveHoursForDay(d, userLeaveRequests);
        const {
          totalLeaveHours,
          morningLeaveHours,
          afternoonLeaveHours,
          leaveType,
        } = leaveData;

        let workHours = 0;
        let note = "";

        if (totalLeaveHours >= WORK_HOURS_REQUIRED) {
          // Full day leave
          workHours = 1.0; // Full work day
          note = `1P`; // Simplified note for full day leave
          totalWorkDays += workHours;
        } else if (totalLeaveHours > 0) {
          // Partial leave
          if (attendance && attendance.checkIn && attendance.checkOut) {
            workHours = calculateWorkDayRatio(
              attendance.checkIn,
              attendance.checkOut,
              totalLeaveHours,
              leaveType
            );

            // Generate simplified note for partial leave
            if (leaveType === "morning") {
              note = `1/2P`; // Half day morning leave
            } else if (leaveType === "afternoon") {
              note = `1/2P`; // Half day afternoon leave
            } else {
              // Mixed leave - calculate fraction
              const leaveRatio = totalLeaveHours / WORK_HOURS_REQUIRED;
              if (leaveRatio >= 0.5) {
                note = `1/2P+`; // More than half day leave
              } else {
                note = `<1/2P`; // Less than half day leave
              }
            }
          } else {
            // User has leave but didn't check in/out
            // Apply minimum 0.5 work day for partial leave (morning or afternoon)
            if (leaveType === "morning" || leaveType === "afternoon") {
              workHours = 0.5; // Minimum half day for partial leave
              note = `1/2P`; // Half day leave
            } else {
              // Mixed leave or full leave hours
              const calculatedRatio = totalLeaveHours / WORK_HOURS_REQUIRED;
              workHours = Math.max(0.5, calculatedRatio); // Minimum 0.5 for any leave
              if (calculatedRatio >= 0.5) {
                note = `1/2P+`;
              } else {
                note = `<1/2P`;
              }
            }
          }
          totalWorkDays += workHours;
        } else if (attendance && attendance.checkIn && attendance.checkOut) {
          // Normal work day with check-in and check-out
          workHours = calculateWorkDayRatio(
            attendance.checkIn,
            attendance.checkOut,
            0,
            null
          );

          note = ``; // No note for normal work
          totalWorkDays += workHours;
        } else if (attendance && attendance.checkIn) {
          // Missing check-out
          workHours = 0;
          note = "Thiếu checkout";
        } else {
          // Absent
          workHours = 0;
          note = "Vắng";
        }

        dailyData.push({
          date: dateKey,
          day: d.getDate(),
          workDayRatio: parseFloat(workHours.toFixed(2)),
          note: note,
        });
      }

      return {
        user: {
          _id: user._id,
          firstName: user.firstName,
          lastName: user.lastName,
          email: user.email,
          employeeId: user.employeeId,
          group: user.group,
        },
        dailyData,
        totalWorkDays: parseFloat(totalWorkDays.toFixed(2)),
      };
    });

    res.json({
      month: parseInt(month),
      year: parseInt(year),
      startDate,
      endDate,
      data: reportData,
    });
  } catch (error) {
    console.error("Error getting attendance report:", error);
    res.status(500).json({
      message: "Lỗi máy chủ",
      error: error.message,
    });
  }
};



module.exports = {
  checkIn: exports.checkIn,
  checkOut: exports.checkOut,
  getUserAttendance: exports.getUserAttendance,
  getTodayAttendance: exports.getTodayAttendance,
  getTeamAttendance: exports.getTeamAttendance,
  getAttendanceReport: exports.getAttendanceReport,
  getAdminUserAttendance: exports.getAdminUserAttendance,
};
