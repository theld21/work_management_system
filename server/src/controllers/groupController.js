const { validationResult } = require("express-validator");
const Group = require("../models/Group");
const User = require("../models/User");

// Create a new group
exports.createGroup = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { name, description, managerId, parentGroupId, handleRequestType } =
      req.body;

    // Only admin can create groups
    if (req.user.role !== "admin") {
      return res.status(403).json({ message: "Không có quyền tạo bộ phận" });
    }

    // Validate handleRequestType
    if (
      !handleRequestType ||
      !["confirm", "approve"].includes(handleRequestType)
    ) {
      return res
        .status(400)
        .json({ message: "Loại xử lý yêu cầu không hợp lệ" });
    }

    // Verify manager exists
    if (managerId) {
      const manager = await User.findById(managerId);
      if (!manager) {
        return res.status(404).json({ message: "Quản lý không tồn tại" });
      }
    }

    // Verify parent group exists if provided
    if (parentGroupId) {
      const parentGroup = await Group.findById(parentGroupId);
      if (!parentGroup) {
        return res.status(404).json({ message: "bộ phận cha không tồn tại" });
      }
    }

    // Create group
    const group = new Group({
      name,
      description,
      manager: managerId,
      parentGroup: parentGroupId,
      handleRequestType,
    });

    await group.save();

    // Update parent group's childGroups array
    if (parentGroupId) {
      await Group.findByIdAndUpdate(parentGroupId, {
        $push: { childGroups: group._id },
      });
    }

    // Update manager's group if specified
    if (managerId) {
      await User.findByIdAndUpdate(managerId, {
        group: group._id,
      });
    }

    res.status(201).json(group);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Lỗi tạo bộ phận" });
  }
};

// Get all groups with pagination
exports.getAllGroups = async (req, res) => {
  try {
    // Only admin can see all groups
    if (req.user.role !== "admin") {
      return res
        .status(403)
        .json({ message: "Không có quyền xem tất cả bộ phận" });
    }

    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const search = req.query.search || "";
    const sortField = req.query.sort || "name";
    const sortDirection = req.query.direction === "desc" ? -1 : 1;
    const skip = (page - 1) * limit;

    // Build search query
    let searchQuery = {};
    if (search) {
      searchQuery = {
        $or: [
          { name: { $regex: search, $options: "i" } },
          { description: { $regex: search, $options: "i" } },
        ],
      };
    }

    // Validate sort field
    const allowedSortFields = ["name", "createdAt", "isActive"];
    const finalSortField = allowedSortFields.includes(sortField)
      ? sortField
      : "name";

    const groups = await Group.find(searchQuery)
      .populate("manager", "firstName lastName username")
      .populate("parentGroup", "name")
      .populate("members", "firstName lastName username")
      .sort({ [finalSortField]: sortDirection })
      .skip(skip)
      .limit(limit);

    const total = await Group.countDocuments(searchQuery);

    res.json({
      groups,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Lỗi lấy bộ phận" });
  }
};

// Get group by ID
exports.getGroupById = async (req, res) => {
  try {
    const { groupId } = req.params;

    const group = await Group.findById(groupId)
      .populate("manager", "firstName lastName username email")
      .populate("parentGroup", "name")
      .populate("childGroups", "name")
      .populate("members", "firstName lastName username email");

    if (!group) {
      return res.status(404).json({ message: "bộ phận không tồn tại" });
    }

    // Check authorization - admin or group manager can view
    if (
      req.user.role !== "admin" &&
      group.manager?.toString() !== req.user.id
    ) {
      return res.status(403).json({ message: "Không có quyền xem bộ phận này" });
    }

    res.json(group);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Lỗi lấy bộ phận" });
  }
};

// Update group
exports.updateGroup = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { groupId } = req.params;
    const { name, description, managerId, parentGroupId, handleRequestType } =
      req.body;

    // Only admin can update groups
    if (req.user.role !== "admin") {
      return res.status(403).json({ message: "Không có quyền cập nhật bộ phận" });
    }

    const group = await Group.findById(groupId);
    if (!group) {
      return res.status(404).json({ message: "bộ phận không tồn tại" });
    }

    // Validate handleRequestType if provided
    if (
      handleRequestType &&
      !["confirm", "approve"].includes(handleRequestType)
    ) {
      return res
        .status(400)
        .json({ message: "Loại xử lý yêu cầu không hợp lệ" });
    }

    // Verify manager exists if provided
    if (managerId) {
      const manager = await User.findById(managerId);
      if (!manager) {
        return res.status(404).json({ message: "Quản lý không tồn tại" });
      }
    }

    // Verify parent group exists if provided
    if (parentGroupId && parentGroupId !== groupId) {
      const parentGroup = await Group.findById(parentGroupId);
      if (!parentGroup) {
        return res.status(404).json({ message: "bộ phận cha không tồn tại" });
      }
    }

    // Remove from old parent group if changing parent
    if (group.parentGroup && group.parentGroup.toString() !== parentGroupId) {
      await Group.findByIdAndUpdate(group.parentGroup, {
        $pull: { childGroups: groupId },
      });
    }

    // Update group
    group.name = name || group.name;
    group.description =
      description !== undefined ? description : group.description;
    if (handleRequestType) {
      group.handleRequestType = handleRequestType;
    }

    if (managerId !== undefined) {
      // Remove old manager's group reference
      if (group.manager) {
        await User.findByIdAndUpdate(group.manager, {
          $unset: { group: 1 },
        });
      }
      group.manager = managerId || null;

      // Set new manager's group reference
      if (managerId) {
        await User.findByIdAndUpdate(managerId, {
          group: groupId,
        });
      }
    }

    if (parentGroupId !== undefined) {
      group.parentGroup = parentGroupId || null;

      // Add to new parent group if specified
      if (parentGroupId) {
        await Group.findByIdAndUpdate(parentGroupId, {
          $addToSet: { childGroups: groupId },
        });
      }
    }

    await group.save();

    // Populate the response
    const updatedGroup = await Group.findById(groupId)
      .populate("manager", "firstName lastName username")
      .populate("parentGroup", "name")
      .populate("members", "firstName lastName username");

    res.json(updatedGroup);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Lỗi cập nhật bộ phận" });
  }
};

// Add member to group
exports.addMember = async (req, res) => {
  try {
    const { groupId } = req.params;
    const { memberIds } = req.body;

    if (!memberIds || !Array.isArray(memberIds) || memberIds.length === 0) {
      return res
        .status(400)
        .json({ message: "Mảng ID thành viên là bắt buộc" });
    }

    const group = await Group.findById(groupId);
    if (!group) {
      return res.status(404).json({ message: "bộ phận không tồn tại" });
    }

    // Get existing member IDs
    const existingMemberIds = group.members.map((member) => member.toString());

    // Filter out members that are already in the group
    const newMemberIds = memberIds.filter(
      (id) => !existingMemberIds.includes(id)
    );

    if (newMemberIds.length === 0) {
      return res
        .status(400)
        .json({ message: "Tất cả thành viên đã có trong bộ phận" });
    }

    // Verify all users exist
    const users = await User.find({ _id: { $in: newMemberIds } });
    if (users.length !== newMemberIds.length) {
      return res
        .status(400)
        .json({ message: "Một hoặc nhiều người dùng không tồn tại" });
    }

    // Add new members
    group.members.push(...newMemberIds);
    await group.save();

    // Populate members for response
    await group.populate("members", "firstName lastName username");

    res.json({
      message: "Thành viên đã được thêm thành công",
      group,
    });
  } catch (error) {
    console.error("Lỗi thêm thành viên vào bộ phận:", error);
    res.status(500).json({ message: "Lỗi thêm thành viên vào bộ phận" });
  }
};

// Remove member from group
exports.removeMember = async (req, res) => {
  try {
    const { groupId, userId } = req.params;

    // Only admin can remove members
    if (req.user.role !== "admin") {
      return res
        .status(403)
        .json({ message: "Không có quyền xóa thành viên khỏi bộ phận" });
    }

    const group = await Group.findById(groupId);
    if (!group) {
      return res.status(404).json({ message: "bộ phận không tồn tại" });
    }

    // Remove user from group
    group.members = group.members.filter(
      (member) => member.toString() !== userId
    );
    await group.save();

    // Update user's group reference
    await User.findByIdAndUpdate(userId, { $unset: { group: 1 } });

    // Return updated group with populated members
    const updatedGroup = await Group.findById(groupId)
      .populate("manager", "firstName lastName username")
      .populate("parentGroup", "name")
      .populate("members", "firstName lastName username email");

    res.json(updatedGroup);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Lỗi xóa bộ phận" });
  }
};

// Delete group
exports.deleteGroup = async (req, res) => {
  try {
    const { groupId } = req.params;

    // Only admin can delete groups
    if (req.user.role !== "admin") {
      return res.status(403).json({ message: "Không có quyền xóa bộ phận" });
    }

    const group = await Group.findById(groupId);
    if (!group) {
      return res.status(404).json({ message: "bộ phận không tồn tại" });
    }

    // Remove group from parent's childGroups array
    if (group.parentGroup) {
      await Group.findByIdAndUpdate(group.parentGroup, {
        $pull: { childGroups: groupId },
      });
    }

    // Update all members to remove group reference
    await User.updateMany({ group: groupId }, { $unset: { group: 1 } });

    // Delete the group
    await Group.findByIdAndDelete(groupId);

    res.json({ message: "bộ phận đã được xóa thành công" });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Lỗi lấy tất cả người dùng" });
  }
};

// Get all users for adding to groups
exports.getAllUsers = async (req, res) => {
  try {
    // Only admin can see all users
    if (req.user.role !== "admin") {
      return res
        .status(403)
        .json({ message: "Không có quyền xem tất cả người dùng" });
    }

    const search = req.query.search || "";

    // Build search query
    let searchQuery = { isActive: true };
    if (search) {
      searchQuery.$or = [
        { firstName: { $regex: search, $options: "i" } },
        { lastName: { $regex: search, $options: "i" } },
        { username: { $regex: search, $options: "i" } },
        { email: { $regex: search, $options: "i" } },
      ];
    }

    const users = await User.find({ ...searchQuery, role: { $ne: "admin" } })
      .select("firstName lastName username email role")
      .sort({ firstName: 1, lastName: 1 })
      .limit(100);

    res.json(users);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Lỗi lấy tất cả người dùng" });
  }
};
