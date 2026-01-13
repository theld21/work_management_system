const { validationResult } = require("express-validator");
const Request = require("../models/Request");
const User = require("../models/User");
const Group = require("../models/Group");
const Attendance = require("../models/Attendance");
const RequestStatus = require("../constants/requestStatus");
const { calculateLeaveDays } = require("../utils/leaveCalculator");

// Create a new request
exports.createRequest = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { type, startTime, endTime, reason } = req.body;
    const userId = req.user.id;

    // Validate endTime phải lớn hơn startTime
    if (!startTime || !endTime || new Date(endTime) <= new Date(startTime)) {
      return res
        .status(400)
        .json({ message: "Thời gian kết thúc phải lớn hơn thời gian bắt đầu" });
    }

    // Nếu là request nghỉ phép, kiểm tra số ngày phép còn lại
    if (type === "leave-request") {
      // Tính số ngày nghỉ
      const leaveDaysNeeded = calculateLeaveDays(startTime, endTime);

      // Kiểm tra user có đủ ngày phép không
      const user = await User.findById(userId);
      if (!user) {
        return res
          .status(404)
          .json({ message: "Không tìm thấy thông tin người dùng" });
      }

      if (user.leaveDays < leaveDaysNeeded) {
        return res.status(400).json({
          message: "Số ngày phép không đủ",
          currentLeaveDays: user.leaveDays,
          requestedDays: leaveDaysNeeded,
        });
      }

      // Create request với số ngày nghỉ đã tính
      const request = new Request({
        user: userId,
        type,
        startTime,
        endTime,
        reason,
        leaveDays: leaveDaysNeeded,
        status: RequestStatus.PENDING,
      });

      await request.save();
      return res.status(201).json(request);
    }

    // Xử lý các loại request khác
    const request = new Request({
      user: userId,
      type,
      startTime,
      endTime,
      reason,
      status: RequestStatus.PENDING,
    });

    await request.save();
    res.status(201).json(request);
  } catch (error) {
    console.error("Lỗi tạo yêu cầu:", error);
    res.status(500).json({ message: "Lỗi tạo yêu cầu" });
  }
};

// Get all requests for current user
exports.getUserRequests = async (req, res) => {
  try {
    const userId = req.user.id;
    const { status, type, page = 1, limit = 10 } = req.query;

    // Convert page and limit to numbers
    const pageNum = parseInt(page, 10);
    const limitNum = parseInt(limit, 10);
    const skip = (pageNum - 1) * limitNum;

    const query = { user: userId };
    if (status) {
      // Convert status text to status code if needed
      query.status = isNaN(parseInt(status))
        ? RequestStatus.getStatusCode(status)
        : parseInt(status);
    }
    if (type) {
      query.type = type;
    }

    // Count total documents for pagination info
    const total = await Request.countDocuments(query);

    // Get paginated requests
    const requests = await Request.find(query)
      .populate({
        path: "confirmedBy.user",
        select: "firstName lastName username",
      })
      .populate({
        path: "approvedBy.user",
        select: "firstName lastName username",
      })
      .populate({
        path: "rejectedBy.user",
        select: "firstName lastName username",
      })
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limitNum);

    // Send back pagination info along with results - ensure we're consistently using the same response format
    res.json({
      requests,
      pagination: {
        total,
        page: pageNum,
        limit: limitNum,
        totalPages: Math.ceil(total / limitNum),
      },
    });
  } catch (error) {
    console.error("Lỗi lấy yêu cầu:", error);
    res.status(500).json({ message: "Lỗi lấy yêu cầu" });
  }
};

// Helper function to get all child groups recursively
async function getAllChildGroups(groupIds) {
  const allGroups = new Set(groupIds.map((id) => id.toString()));
  let newGroupsFound = true;

  while (newGroupsFound) {
    newGroupsFound = false;
    const groups = await Group.find({
      parentGroup: { $in: Array.from(allGroups) },
    });

    for (const group of groups) {
      if (!allGroups.has(group._id.toString())) {
        allGroups.add(group._id.toString());
        newGroupsFound = true;
      }
    }
  }

  return Array.from(allGroups);
}

// Helper function to get all users from groups
async function getAllUsersFromGroups(groupIds) {
  const users = await User.find({ group: { $in: groupIds } });
  return users.map((user) => user._id);
}

// Get requests that manager can handle based on their group's handleRequestType
exports.getRequestsForManager = async (req, res) => {
  try {
    const { id, role } = req.user;
    const { page = 1, limit = 10 } = req.query;

    // Convert page and limit to numbers
    const pageNum = parseInt(page, 10);
    const limitNum = parseInt(limit, 10);
    const skip = (pageNum - 1) * limitNum;

    let query = {};
    let managerType = null;

    // Admin can see all requests and can approve/reject any request
    if (role === "admin") {
      // Admin can see all requests
      query = {};
      managerType = "admin"; // Special type for admin
    } else {
      // Find the group where the user is a manager
      const managerGroup = await Group.findOne({ manager: id });

      if (!managerGroup) {
        return res.json({
          requests: [],
          pagination: {
            total: 0,
            page: pageNum,
            limit: limitNum,
            totalPages: 0,
          },
        });
      }

      // Get all child groups recursively
      const allGroupIds = await getAllChildGroups([managerGroup._id]);

      // Get all users from these groups
      const userIds = await getAllUsersFromGroups(allGroupIds);

      // Build query based on handleRequestType
      query = {
        user: { $in: userIds },
      };

      // For confirm managers: show all requests, but can only confirm/reject PENDING ones
      if (managerGroup.handleRequestType === "confirm") {
        // No additional status filter - show all requests
        managerType = "confirm";
      }
      // For approve managers: only show CONFIRMED requests that they can approve/reject
      else if (managerGroup.handleRequestType === "approve") {
        query.status = { $ne: RequestStatus.PENDING };
        managerType = "approve";
      }
      // For other cases (no handleRequestType): don't show any requests
      else {
        return res.json({
          requests: [],
          pagination: {
            total: 0,
            page: pageNum,
            limit: limitNum,
            totalPages: 0,
          },
        });
      }
    }

    const total = await Request.countDocuments(query);

    const requests = await Request.find(query)
      .populate("user", "firstName lastName username email group")
      .populate({
        path: "user",
        populate: {
          path: "group",
          select: "name parentGroup",
        },
      })
      .populate({
        path: "confirmedBy.user",
        select: "firstName lastName username",
      })
      .populate({
        path: "approvedBy.user",
        select: "firstName lastName username",
      })
      .populate({
        path: "rejectedBy.user",
        select: "firstName lastName username",
      })
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limitNum);

    console.log(
      `[MANAGER REQUESTS] Manager: ${id}, Role: ${role}, ManagerType: ${managerType}, Total Requests: ${total}`
    );

    return res.json({
      requests,
      pagination: {
        total,
        page: pageNum,
        limit: limitNum,
        totalPages: Math.ceil(total / limitNum),
      },
      managerType: managerType, // Thêm thông tin này để client biết loại manager
    });
  } catch (error) {
    console.error("Lỗi lấy danh sách yêu cầu:", error);
    res.status(500).json({ message: "Lỗi lấy danh sách yêu cầu" });
  }
};

// Process request (approve/reject)
exports.processRequest = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { requestId } = req.params;
    const { action, comment } = req.body;
    const { id: userId, role } = req.user;

    // Find the request
    const request = await Request.findById(requestId).populate("user", "group");
    if (!request) {
      return res.status(404).json({ message: "Yêu cầu không tồn tại" });
    }

    // Check if the request can be processed
    if (
      request.status === RequestStatus.REJECTED ||
      request.status === RequestStatus.CANCELLED
    ) {
      return res.status(400).json({ message: "Yêu cầu này không thể xử lý" });
    }

    let canProcessRequest = false;
    let userGroup = null;

    // Admin can process any request
    if (role === "admin") {
      canProcessRequest = true;
    } else {
      // Find the group where the user is a manager
      const managerGroup = await Group.findOne({ manager: userId });
      if (!managerGroup) {
        return res
          .status(403)
          .json({ message: "Bạn không có quyền xử lý yêu cầu này" });
      }

      // Get all child groups recursively
      const allGroupIds = await getAllChildGroups([managerGroup._id]);

      // Check if the request's user belongs to any of the managed groups
      if (!allGroupIds.includes(request.user.group.toString())) {
        return res
          .status(403)
          .json({ message: "Bạn không có quyền xử lý yêu cầu này" });
      }

      canProcessRequest = true;
      userGroup = managerGroup;
    }

    if (!canProcessRequest) {
      return res
        .status(403)
        .json({ message: "Bạn không có quyền xử lý yêu cầu này" });
    }

    // Handle different actions
    switch (action) {
      case "confirm":
        // Admin can confirm any pending request
        // Managers can only confirm if they have confirm permission
        if (request.status !== RequestStatus.PENDING) {
          return res
            .status(400)
            .json({ message: "Chỉ có thể xác nhận yêu cầu đang chờ" });
        }
        if (role !== "admin" && userGroup?.handleRequestType !== "confirm") {
          return res
            .status(403)
            .json({ message: "Bộ phận của bạn không có quyền xác nhận yêu cầu" });
        }
        request.status = RequestStatus.CONFIRMED;
        request.confirmedBy = {
          user: userId,
          date: new Date(),
          comment: comment || "",
        };
        break;

      case "approve":
        // Admin can approve any confirmed request, or can directly approve pending requests
        // Managers can only approve if they have approve permission and request is confirmed
        if (role === "admin") {
          // Admin can approve pending or confirmed requests
          if (
            request.status !== RequestStatus.PENDING &&
            request.status !== RequestStatus.CONFIRMED
          ) {
            return res
              .status(400)
              .json({
                message:
                  "Chỉ có thể phê duyệt yêu cầu đang chờ hoặc đã được xác nhận",
              });
          }
        } else {
          // Managers need approve permission and request must be confirmed
          if (request.status !== RequestStatus.CONFIRMED) {
            return res
              .status(400)
              .json({
                message: "Chỉ có thể phê duyệt yêu cầu đã được xác nhận",
              });
          }
          if (userGroup?.handleRequestType !== "approve") {
            return res
              .status(403)
              .json({
                message: "Bộ phận của bạn không có quyền phê duyệt yêu cầu",
              });
          }
        }

        // Nếu là request nghỉ phép, kiểm tra và trừ số ngày phép
        if (request.type === "leave-request") {
          const user = await User.findById(request.user._id);
          if (!user) {
            return res
              .status(404)
              .json({ message: "Không tìm thấy thông tin người dùng" });
          }

          // Kiểm tra lại số ngày phép còn lại
          if (user.leaveDays < request.leaveDays) {
            return res.status(400).json({
              message: "Người dùng không còn đủ ngày phép",
              currentLeaveDays: user.leaveDays,
              requestedDays: request.leaveDays,
            });
          }

          // Trừ số ngày phép
          user.leaveDays -= request.leaveDays;
          await user.save();
        }

        request.status = RequestStatus.APPROVED;
        request.approvedBy = {
          user: userId,
          date: new Date(),
          comment: comment || "",
        };

        // Handle attendance update for work-time requests
        if (request.type === "work-time") {
          try {
            const requestDate = new Date(request.startTime);
            requestDate.setHours(0, 0, 0, 0);
            const endOfDay = new Date(requestDate);
            endOfDay.setHours(23, 59, 59, 999);

            // Find existing attendance using checkIn field
            let attendance = await Attendance.findOne({
              user: request.user._id,
              checkIn: {
                $gte: requestDate,
                $lte: endOfDay,
              },
            });

            if (!attendance) {
              attendance = new Attendance({
                user: request.user._id,
                checkIn: request.startTime,
                checkOut: request.endTime,
              });
            } else {
              attendance.checkIn = request.startTime;
              attendance.checkOut = request.endTime;
            }

            await attendance.save();
          } catch (error) {
            console.error("Lỗi cập nhật attendance:", error);
          }
        }
        break;

      case "reject":
        // Admin can reject any processable request
        // Managers have different restrictions based on their type
        if (role === "admin") {
          // Admin can reject pending, confirmed requests
          if (
            request.status !== RequestStatus.PENDING &&
            request.status !== RequestStatus.CONFIRMED
          ) {
            return res
              .status(400)
              .json({ message: "Không thể từ chối yêu cầu này" });
          }
        } else {
          if (
            userGroup?.handleRequestType === "confirm" &&
            request.status !== RequestStatus.PENDING
          ) {
            return res
              .status(400)
              .json({ message: "Bạn chỉ có thể từ chối yêu cầu đang chờ" });
          }
          if (
            userGroup?.handleRequestType === "approve" &&
            request.status !== RequestStatus.CONFIRMED
          ) {
            return res.status(400).json({
              message: "Bạn chỉ có thể từ chối yêu cầu đã được xác nhận",
            });
          }
        }
        request.status = RequestStatus.REJECTED;
        request.rejectedBy = {
          user: userId,
          date: new Date(),
          comment: comment || "",
        };
        break;

      default:
        return res.status(400).json({ message: "Hành động không hợp lệ" });
    }

    await request.save();
    res.json(request);
  } catch (error) {
    console.error("Lỗi xử lý yêu cầu:", error);
    res.status(500).json({ message: "Lỗi xử lý yêu cầu" });
  }
};

// Cancel request by the user who created it
exports.cancelRequest = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { requestId } = req.params;
    const { reason = "Yêu cầu đã được hủy bởi người dùng" } = req.body;
    const userId = req.user.id;

    // Find the request
    const request = await Request.findById(requestId);
    if (!request) {
      return res.status(404).json({ message: "Yêu cầu không tồn tại" });
    }

    // Check if the request belongs to the user
    if (request.user.toString() !== userId) {
      return res
        .status(403)
        .json({ message: "Không có quyền hủy yêu cầu này" });
    }

    // Check if the request is still pending
    if (request.status !== RequestStatus.PENDING) {
      return res
        .status(400)
        .json({ message: "Chỉ yêu cầu đang chờ mới có thể được hủy" });
    }

    // Lấy thông tin người dùng hiện tại để thêm vào response
    const currentUser = await User.findById(userId).select(
      "firstName lastName"
    );
    if (!currentUser) {
      return res.status(404).json({ message: "Người dùng không tồn tại" });
    }

    // Update request status to cancelled
    request.status = RequestStatus.CANCELLED;
    request.cancelledBy = {
      user: userId,
      date: new Date(),
      reason: reason,
    };

    await request.save();

    // Tạo một đối tượng response với thông tin đầy đủ
    const responseData = request.toObject();

    // Thêm thông tin người hủy vào response
    responseData.cancelledBy = {
      ...responseData.cancelledBy,
      user: {
        _id: currentUser._id,
        firstName: currentUser.firstName,
        lastName: currentUser.lastName,
      },
    };

    res.json({
      success: true,
      message: "Yêu cầu đã được hủy thành công",
      data: responseData,
    });
  } catch (error) {
    console.error("Lỗi hủy yêu cầu:", error);
    res.status(500).json({ message: "Lỗi hủy yêu cầu" });
  }
};

// Calculate leave days for a date range
exports.calculateLeaveDaysForRange = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { startTime, endTime } = req.body;
    const userId = req.user.id;

    // Tính số ngày nghỉ
    const leaveDaysNeeded = calculateLeaveDays(startTime, endTime);

    // Lấy thông tin user
    const user = await User.findById(userId);
    if (!user) {
      return res
        .status(404)
        .json({ message: "Không tìm thấy thông tin người dùng" });
    }

    res.json({
      leaveDaysNeeded,
      currentLeaveDays: user.leaveDays,
      isEnough: user.leaveDays >= leaveDaysNeeded,
    });
  } catch (error) {
    console.error("Lỗi tính toán ngày phép:", error);
    res.status(500).json({ message: "Lỗi tính toán ngày phép" });
  }
};

// Get current user's leave days
exports.getCurrentLeaveDays = async (req, res) => {
  try {
    const userId = req.user.id;

    const user = await User.findById(userId);
    if (!user) {
      return res
        .status(404)
        .json({ message: "Không tìm thấy thông tin người dùng" });
    }

    res.json({
      currentLeaveDays: user.leaveDays,
    });
  } catch (error) {
    console.error("Lỗi lấy số ngày phép:", error);
    res.status(500).json({ message: "Lỗi lấy số ngày phép" });
  }
};

exports.calculateDays = async (req, res) => {
  try {
    const { startTime, endTime } = req.body;

    if (!startTime || !endTime) {
      return res
        .status(400)
        .json({ message: "Vui lòng cung cấp thời gian bắt đầu và kết thúc" });
    }

    const leaveDays = calculateLeaveDays(startTime, endTime);

    res.json({ leaveDays });
  } catch (err) {
    console.error("Error calculating leave days:", err);
    res.status(500).json({ message: "Có lỗi xảy ra khi tính số ngày nghỉ" });
  }
};
