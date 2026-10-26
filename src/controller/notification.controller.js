import mongoose from "mongoose";
import Notification from "../models/notification.model.js";
import WorkspaceMember from "../models/workspace-member.model.js";

// GET /api/notifications
export const getMyNotifications = async (req, res, next) => {
  try {
    const page = Number(req.query.page ?? 1);
    const limit = Number(req.query.limit ?? 20);

    if (
      !Number.isInteger(page) ||
      !Number.isInteger(limit) ||
      page < 1 ||
      limit < 1 ||
      limit > 100
    ) {
      return res.status(400).json({
        success: false,
        message: "Invalid pagination values",
      });
    }

    const filter = {
      recipient: req.user._id,
    };

    // Optionally filter notifications by workspace
    if (req.query.workspaceId) {
      if (!mongoose.isValidObjectId(req.query.workspaceId)) {
        return res.status(400).json({
          success: false,
          message: "Invalid workspace ID",
        });
      }

      const membership = await WorkspaceMember.exists({
        workspace: req.query.workspaceId,
        user: req.user._id,
        status: "active",
      });

      if (!membership) {
        return res.status(403).json({
          success: false,
          message: "You are not an active member of this workspace",
        });
      }

      filter.workspace = req.query.workspaceId;
    }

    const [notifications, total, unreadCount] = await Promise.all([
      Notification.find(filter)
        .populate("actor", "name email")
        .populate("task", "title status priority")
        .sort({ createdAt: -1, _id: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .lean(),

      Notification.countDocuments(filter),

      Notification.countDocuments({
        ...filter,
        isRead: false,
      }),
    ]);

    return res.status(200).json({
      success: true,
      data: notifications,
      unreadCount,
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    next(error);
  }
};

// PATCH /api/notifications/:notificationId/read
export const markNotificationAsRead = async (req, res, next) => {
  try {
    const { notificationId } = req.params;

    if (!mongoose.isValidObjectId(notificationId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid notification ID",
      });
    }

    // Users can only mark their own notifications as read.
    const notification = await Notification.findOneAndUpdate(
      {
        _id: notificationId,
        recipient: req.user._id,
        isRead: false,
      },
      {
        $set: {
          isRead: true,
          readAt: new Date(),
        },
      },
      { returnDocument: "after" }
    );

    if (!notification) {
      const existing = await Notification.exists({
        _id: notificationId,
        recipient: req.user._id,
      });

      if (!existing) {
        return res.status(404).json({
          success: false,
          message: "Notification not found",
        });
      }

      return res.status(200).json({
        success: true,
        message: "Notification was already read",
      });
    }

    return res.status(200).json({
      success: true,
      message: "Notification marked as read",
      data: notification,
    });
  } catch (error) {
    next(error);
  }
};

// PATCH /api/notifications/read-all
export const markAllNotificationsAsRead = async (req, res, next) => {
  try {
    const result = await Notification.updateMany(
      {
        recipient: req.user._id,
        isRead: false,
      },
      {
        $set: {
          isRead: true,
          readAt: new Date(),
        },
      }
    );

    return res.status(200).json({
      success: true,
      message: "Notifications marked as read",
      updatedCount: result.modifiedCount,
    });
  } catch (error) {
    next(error);
  }
};
