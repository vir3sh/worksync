import mongoose from "mongoose";
import User from "../models/user.model.js";

const escapeRegex = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

// GET /api/admin/users
export const getAdminUsers = async (req, res) => {
  try {
    const search = String(req.query.search || "").trim();
    const page = Math.max(1, Number.parseInt(req.query.page, 10) || 1);
    const limit = Math.min(
      50,
      Math.max(1, Number.parseInt(req.query.limit, 10) || 10),
    );

    const filter = search
      ? {
          $or: [
            { name: { $regex: escapeRegex(search), $options: "i" } },
            { email: { $regex: escapeRegex(search), $options: "i" } },
          ],
        }
      : {};

    const [users, total] = await Promise.all([
      User.find(filter)
        .select("name email role canCreateWorkspace createdAt")
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .lean(),

      User.countDocuments(filter),
    ]);

    return res.status(200).json({
      success: true,
      message: "Users fetched successfully",
      data: {
        users,
        pagination: {
          total,
          page,
          limit,
          totalPages: Math.ceil(total / limit),
        },
      },
    });
  } catch (error) {
    console.error("Get admin users error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to fetch users",
    });
  }
};

// PATCH /api/admin/users/:userId/workspace-access
export const updateWorkspaceCreationAccess = async (req, res) => {
  try {
    const { userId } = req.params;
    const { canCreateWorkspace } = req.body;

    if (!mongoose.isValidObjectId(userId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid user ID",
      });
    }

    if (typeof canCreateWorkspace !== "boolean") {
      return res.status(400).json({
        success: false,
        message: "canCreateWorkspace must be true or false",
      });
    }

    const user = await User.findById(userId);

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    user.canCreateWorkspace = canCreateWorkspace;
    await user.save();

    return res.status(200).json({
      success: true,
      message: canCreateWorkspace
        ? "Workspace creation access granted successfully"
        : "Workspace creation access revoked successfully",
      data: {
        user: {
          id: user._id,
          name: user.name,
          email: user.email,
          canCreateWorkspace: user.canCreateWorkspace,
        },
      },
    });
  } catch (error) {
    console.error("Update workspace access error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to update workspace creation access",
    });
  }
};
