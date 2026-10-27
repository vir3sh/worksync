import { Router } from "express";
import {
  createWorkspace,
  getMyWorkspaces,
  addWorkspaceMember,
  getWorkspaceMembers,
  deleteWorkspace,
  removeWorkspaceMember,
  updateWorkspaceMemberRole,
} from "../controller/workspace.controller.js";
import authenticateUser from "../middleware/auth.middleware.js";

const workspaceRouter = Router();

workspaceRouter.post("/create-workspace", authenticateUser, createWorkspace);
workspaceRouter.get("/my-workspaces", authenticateUser, getMyWorkspaces);
workspaceRouter.delete("/:workspaceId", authenticateUser, deleteWorkspace);
workspaceRouter.patch(
  "/:workspaceId/members/:userId/role",
  authenticateUser,
  updateWorkspaceMemberRole,
);
workspaceRouter.post(
  "/:workspaceId/members",
  authenticateUser,
  addWorkspaceMember,
);
workspaceRouter.get(
  "/:workspaceId/members",
  authenticateUser,
  getWorkspaceMembers,
);

workspaceRouter.delete(
  "/:workspaceId/members/:userId",
  authenticateUser,
  removeWorkspaceMember,
);

export default workspaceRouter;
