import { Router } from "express";

import {
  getMyNotifications,
  markNotificationAsRead,
  markAllNotificationsAsRead,
} from "../controller/notification.controller.js";

import authenticateUser from "../middleware/auth.middleware.js";

const notificationRouter = Router();

// Get all notifications for the logged-in user
notificationRouter.get("/", authenticateUser, getMyNotifications);

// Mark all notifications as read
notificationRouter.patch(
  "/read-all",
  authenticateUser,
  markAllNotificationsAsRead,
);

// Mark a single notification as read
notificationRouter.patch(
  "/:notificationId/read",
  authenticateUser,
  markNotificationAsRead,
);

export default notificationRouter;
