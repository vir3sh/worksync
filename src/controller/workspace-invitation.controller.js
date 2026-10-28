import mongoose from "mongoose";
import Workspace from "../models/workspace.model.js";
import WorkspaceMember from "../models/workspace-member.model.js";
import WorkspaceInvitation from "../models/workspace-invitation.model.js";
import User from "../models/user.model.js";

const isValidObjectId = (id) => mongoose.isValidObjectId(id);

export const createWorkspaceInvitation = async (req, res) => {
  try {
    const { workspaceId } = req.params;
    const { email, role = "employee" } = req.body;

    if (!isValidObjectId(workspaceId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid workspace ID",
      });
    }

    if (!email || typeof email !== "string") {
      return res.status(400).json({
        success: false,
        message: "Email is required",
      });
    }

    const normalizedEmail = email.trim().toLowerCase();

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail)) {
      return res.status(400).json({
        success: false,
        message: "Please provide a valid email address",
      });
    }

    const allowedRoles = ["admin", "manager", "employee"];

    if (!allowedRoles.includes(role)) {
      return res.status(400).json({
        success: false,
        message: "Invalid workspace role",
      });
    }

    const workspace = await Workspace.findById(workspaceId);

    if (!workspace || workspace.status === "archived") {
      return res.status(404).json({
        success: false,
        message: "Workspace not found",
      });
    }

    const requesterMembership = await WorkspaceMember.findOne({
      workspace: workspaceId,
      user: req.user._id,
      status: "active",
    });

    if (
      !requesterMembership ||
      !["owner", "admin"].includes(requesterMembership.role)
    ) {
      return res.status(403).json({
        success: false,
        message: "Only workspace owners and admins can invite members",
      });
    }

    const invitedUser = await User.findOne({
      email: normalizedEmail,
    });

    if (!invitedUser) {
      return res.status(404).json({
        success: false,
        message: "No registered user found with this email",
      });
    }

    if (invitedUser._id.equals(req.user._id)) {
      return res.status(400).json({
        success: false,
        message: "You cannot invite yourself",
      });
    }

    const existingMembership = await WorkspaceMember.findOne({
      workspace: workspaceId,
      user: invitedUser._id,
    });

    if (existingMembership?.status === "active") {
      return res.status(409).json({
        success: false,
        message: "This user is already a workspace member",
      });
    }

    const existingInvitation = await WorkspaceInvitation.findOne({
      workspace: workspaceId,
      invitedUser: invitedUser._id,
      status: "pending",
      expiresAt: { $gt: new Date() },
    });

    if (existingInvitation) {
      return res.status(409).json({
        success: false,
        message: "A pending invitation already exists for this user",
      });
    }

    const invitation = await WorkspaceInvitation.create({
      workspace: workspaceId,
      invitedUser: invitedUser._id,
      invitedBy: req.user._id,
      role,
      status: "pending",
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
    });

    return res.status(201).json({
      success: true,
      message: "Workspace invitation created successfully",
      data: { invitation },
    });
  } catch (error) {
    console.error("Create workspace invitation error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to create workspace invitation",
    });
  }
};

export const getPendingInvitations = async (req, res) => {
  try {
    const invitations = await WorkspaceInvitation.find({
      invitedUser: req.user._id,
      status: "pending",
      expiresAt: { $gt: new Date() },
    })
      .populate("workspace", "name slug description")
      .populate("invitedBy", "name email")
      .sort({ createdAt: -1 });

    return res.status(200).json({
      success: true,
      message: "Pending invitations fetched successfully",
      data: { invitations },
    });
  } catch (error) {
    console.error("Get pending invitations error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to fetch pending invitations",
    });
  }
};

export const acceptWorkspaceInvitation = async (req, res) => {
  try {
    const { invitationId } = req.params;

    if (!mongoose.isValidObjectId(invitationId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid invitation ID",
      });
    }

    // Atomically claim a valid pending invitation.
    const invitation = await WorkspaceInvitation.findOneAndUpdate(
      {
        _id: invitationId,
        invitedUser: req.user._id,
        status: "pending",
        expiresAt: { $gt: new Date() },
      },
      {
        $set: { status: "accepted" },
      },
      { new: true },
    );

    if (!invitation) {
      const existingInvitation = await WorkspaceInvitation.findOne({
        _id: invitationId,
        invitedUser: req.user._id,
        status: "pending",
      });

      if (existingInvitation && existingInvitation.expiresAt <= new Date()) {
        await WorkspaceInvitation.updateOne(
          {
            _id: invitationId,
            invitedUser: req.user._id,
            status: "pending",
          },
          { $set: { status: "expired" } },
        );

        return res.status(410).json({
          success: false,
          message: "This invitation has expired",
        });
      }

      return res.status(404).json({
        success: false,
        message: "Invitation not found or already processed",
      });
    }

    try {
      const workspace = await Workspace.findById(invitation.workspace);

      if (!workspace || workspace.status === "archived") {
        await WorkspaceInvitation.updateOne(
          { _id: invitation._id, status: "accepted" },
          { $set: { status: "pending" } },
        );

        return res.status(404).json({
          success: false,
          message: "Workspace is no longer available",
        });
      }

      let membership = await WorkspaceMember.findOne({
        workspace: invitation.workspace,
        user: req.user._id,
      });

      if (membership?.status === "active") {
        return res.status(200).json({
          success: true,
          message: "You are already a member of this workspace",
          data: { membership, invitation },
        });
      }

      if (membership) {
        membership.role = invitation.role;
        membership.status = "active";
        membership.joinedAt = new Date();

        await membership.save();
      } else {
        membership = await WorkspaceMember.create({
          workspace: invitation.workspace,
          user: req.user._id,
          role: invitation.role,
          status: "active",
          joinedAt: new Date(),
        });
      }

      return res.status(200).json({
        success: true,
        message: "Workspace invitation accepted successfully",
        data: { membership, invitation },
      });
    } catch (error) {
      // Restore the invitation so the user can retry after a failure.
      await WorkspaceInvitation.updateOne(
        { _id: invitation._id, status: "accepted" },
        { $set: { status: "pending" } },
      );

      throw error;
    }
  } catch (error) {
    console.error("Accept workspace invitation error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to accept workspace invitation",
    });
  }
};

export const declineWorkspaceInvitation = async (req, res) => {
  try {
    const { invitationId } = req.params;

    if (!isValidObjectId(invitationId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid invitation ID",
      });
    }

    const invitation = await WorkspaceInvitation.findOne({
      _id: invitationId,
      invitedUser: req.user._id,
      status: "pending",
    });

    if (!invitation) {
      return res.status(404).json({
        success: false,
        message: "Invitation not found or already processed",
      });
    }

    if (invitation.expiresAt <= new Date()) {
      invitation.status = "expired";
      await invitation.save();

      return res.status(410).json({
        success: false,
        message: "This invitation has expired",
      });
    }

    invitation.status = "declined";
    await invitation.save();

    return res.status(200).json({
      success: true,
      message: "Workspace invitation declined successfully",
    });
  } catch (error) {
    console.error("Decline workspace invitation error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to decline workspace invitation",
    });
  }
};

export const getSentWorkspaceInvitations = async (req, res) => {
  try {
    const { workspaceId } = req.params;

    if (!mongoose.isValidObjectId(workspaceId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid workspace ID",
      });
    }

    const membership = await WorkspaceMember.findOne({
      workspace: workspaceId,
      user: req.user._id,
      status: "active",
    });

    if (!membership || !["owner", "admin"].includes(membership.role)) {
      return res.status(403).json({
        success: false,
        message: "Only workspace owners and admins can view sent invitations",
      });
    }

    const invitations = await WorkspaceInvitation.find({
      workspace: workspaceId,
    })
      .populate("invitedUser", "name email")
      .populate("invitedBy", "name email")
      .sort({ createdAt: -1 })
      .lean();

    const now = new Date();

    const formattedInvitations = invitations.map((invitation) => ({
      ...invitation,
      status:
        invitation.status === "pending" && new Date(invitation.expiresAt) <= now
          ? "expired"
          : invitation.status,
    }));

    return res.status(200).json({
      success: true,
      message: "Sent invitations fetched successfully",
      data: {
        invitations: formattedInvitations,
      },
    });
  } catch (error) {
    console.error("Get sent workspace invitations error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to fetch sent invitations",
    });
  }
};
