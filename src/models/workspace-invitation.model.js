import mongoose from "mongoose";

const workspaceInvitationSchema = new mongoose.Schema(
  {
    workspace: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Workspace",
      required: true,
    },
    invitedUser: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    invitedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    role: {
      type: String,
      enum: ["admin", "manager", "employee"],
      default: "employee",
      required: true,
    },
    status: {
      type: String,
      enum: ["pending", "accepted", "declined", "revoked", "expired"],
      default: "pending",
    },
    expiresAt: {
      type: Date,
      required: true,
    },
  },
  { timestamps: true },
);

workspaceInvitationSchema.index({
  workspace: 1,
  invitedUser: 1,
  status: 1,
});

const WorkspaceInvitation = mongoose.model(
  "WorkspaceInvitation",
  workspaceInvitationSchema,
);

export default WorkspaceInvitation;