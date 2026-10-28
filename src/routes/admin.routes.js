import { Router } from "express";

import authenticateUser from "../middleware/auth.middleware.js";
import requireSystemAdmin from "../middleware/system-admin.middleware.js";

import {
  getAdminUsers,
  updateWorkspaceCreationAccess,
} from "../controller/admin.controller.js";

const adminRouter = Router();

// All admin routes require login and system-admin permission.
adminRouter.use(authenticateUser, requireSystemAdmin);

// List users; supports ?search=email&page=1&limit=10
adminRouter.get("/users", getAdminUsers);

// Grant or revoke permission to create workspaces.
adminRouter.patch(
  "/users/:userId/workspace-access",
  updateWorkspaceCreationAccess,
);

export default adminRouter;
