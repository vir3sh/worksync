import { Router } from "express";

import { getWorkspaceDashboard } from "../controller/dashboard.controller.js";
import authenticateUser from "../middleware/auth.middleware.js";

const dashRouter = Router();

dashRouter.get(
  "/workspaces/:workspaceId",
  authenticateUser,
  getWorkspaceDashboard,
);

export default dashRouter;
