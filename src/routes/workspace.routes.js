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
import {
  createWorkspaceInvitation,
  getPendingInvitations,
  acceptWorkspaceInvitation,
  declineWorkspaceInvitation,
  getSentWorkspaceInvitations,
} from "../controller/workspace-invitation.controller.js";
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
// workspaceRouter.post(
//   "/:workspaceId/members",
//   authenticateUser,
//   addWorkspaceMember,
// );
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

// Invitations for the logged-in user
workspaceRouter.get(
  "/invitations/pending",
  authenticateUser,
  getPendingInvitations,
);

workspaceRouter.patch(
  "/invitations/:invitationId/accept",
  authenticateUser,
  acceptWorkspaceInvitation,
);

workspaceRouter.patch(
  "/invitations/:invitationId/decline",
  authenticateUser,
  declineWorkspaceInvitation,
);

// Create an invitation for a workspace
workspaceRouter.post(
  "/:workspaceId/invitations",
  authenticateUser,
  createWorkspaceInvitation,
);

workspaceRouter.get(
  "/:workspaceId/invitations",
  authenticateUser,
  getSentWorkspaceInvitations,
);

export default workspaceRouter;
