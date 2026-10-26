import Workspace from "../models/workspace.model.js";
import WorkspaceMember from "../models/workspace-member.model.js";
import { createWorkspaceValidation } from "../schema/workspace.schema.js";
import { addWorkspaceMemberValidation } from "../schema/workspace-member.schema.js";
import User from "../models/user.model.js";
import mongoose from "mongoose";
import ProjectMember from "../models/project-member.model.js";

export const createWorkspace = async (req, res, next) => {
  let workspace;

  try {
    const validation = createWorkspaceValidation.safeParse(req.body);

    if (!validation.success) {
      return res.status(400).json({
        success: false,
        message: "Validation failed",
        errors: validation.error.issues.map((issue) => ({
          field: issue.path.join("."),
          message: issue.message,
        })),
      });
    }

    const { name, slug, description } = validation.data;
    const userId = req.user._id;

    // Step 1: Create the workspace.
    workspace = await Workspace.create({
      name,
      slug,
      description,
      createdBy: userId,
    });

    // Step 2: Create the owner's membership.
    try {
      await WorkspaceMember.create({
        workspace: workspace._id,
        user: userId,
        role: "owner",
        status: "active",
      });
    } catch (membershipError) {
      // Roll back the workspace if membership creation fails.
      try {
        await Workspace.deleteOne({ _id: workspace._id });
      } catch (cleanupError) {
        console.error("Workspace cleanup failed:", cleanupError.message);
      }

      throw membershipError;
    }

    // Step 3: Return the response.
    return res.status(201).json({
      success: true,
      message: "Workspace created successfully",
      data: {
        workspace: {
          id: workspace._id,
          name: workspace.name,
          slug: workspace.slug,
          description: workspace.description,
          createdBy: workspace.createdBy,
          status: workspace.status,
          createdAt: workspace.createdAt,
        },
        membership: {
          role: "owner",
          status: "active",
        },
      },
    });
  } catch (error) {
    if (error.code === 11000 && error.keyPattern?.slug) {
      return res.status(409).json({
        success: false,
        message: "This workspace slug is already taken",
      });
    }

    if (error.code === 11000 && error.keyPattern?.workspace) {
      return res.status(409).json({
        success: false,
        message: "Workspace membership already exists",
      });
    }

    return next(error);
  }
};

export const getMyWorkspaces = async (req, res, next) => {
  try {
    const memberships = await WorkspaceMember.find({
      user: req.user._id,
      status: "active",
    })
      .populate({
        path: "workspace",
        select: "name slug description status createdAt",
        match: { status: "active" },
      })
      .sort({ createdAt: -1 })
      .lean();

    const workspaces = memberships
      .filter((membership) => membership.workspace)
      .map((membership) => ({
        id: membership.workspace._id,
        name: membership.workspace.name,
        slug: membership.workspace.slug,
        description: membership.workspace.description,
        status: membership.workspace.status,
        role: membership.role,
        joinedAt: membership.joinedAt,
      }));

    return res.status(200).json({
      success: true,
      count: workspaces.length,
      data: { workspaces },
    });
  } catch (error) {
    next(error);
  }
};

export const addWorkspaceMember = async (req, res, next) => {
  try {
    const validation = addWorkspaceMemberValidation.safeParse(req.body);

    if (!validation.success) {
      return res.status(400).json({
        success: false,
        message: "Validation failed",
        errors: validation.error.issues.map((issue) => ({
          field: issue.path.join("."),
          message: issue.message,
        })),
      });
    }

    const { email, role } = validation.data;
    const { workspaceId } = req.params;

    if (!mongoose.isValidObjectId(workspaceId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid workspace ID",
      });
    }

    // Confirm that the workspace exists and is active.
    const workspace = await Workspace.findOne({
      _id: workspaceId,
      status: "active",
    });

    if (!workspace) {
      return res.status(404).json({
        success: false,
        message: "Workspace not found",
      });
    }

    // Only active owners and admins can add members.
    const currentMembership = await WorkspaceMember.findOne({
      workspace: workspace._id,
      user: req.user._id,
      status: "active",
    });

    if (
      !currentMembership ||
      !["owner", "admin"].includes(currentMembership.role)
    ) {
      return res.status(403).json({
        success: false,
        message: "You do not have permission to add workspace members",
      });
    }

    // Find the existing registered user.
    const user = await User.findOne({
      email,
      status: "active",
    }).select("_id name email");

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "No active registered user found with this email",
      });
    }

    // Prevent duplicate memberships.
    const existingMembership = await WorkspaceMember.exists({
      workspace: workspace._id,
      user: user._id,
    });

    if (existingMembership) {
      return res.status(409).json({
        success: false,
        message: "This user already has a workspace membership",
      });
    }

    const membership = await WorkspaceMember.create({
      workspace: workspace._id,
      user: user._id,
      role,
      status: "active",
      joinedAt: new Date(),
    });

    return res.status(201).json({
      success: true,
      message: "Workspace member added successfully",
      data: {
        member: {
          id: membership._id,
          user: {
            id: user._id,
            name: user.name,
            email: user.email,
          },
          role: membership.role,
          status: membership.status,
          joinedAt: membership.joinedAt,
        },
      },
    });
  } catch (error) {
    // Handle concurrent requests that try to add the same user.
    if (error.code === 11000) {
      return res.status(409).json({
        success: false,
        message: "This user already has a workspace membership",
      });
    }

    next(error);
  }
};

export const getWorkspaceMembers = async (req, res, next) => {
  try {
    const { workspaceId } = req.params;

    if (!mongoose.isValidObjectId(workspaceId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid workspace ID",
      });
    }

    const workspace = await Workspace.findOne({
      _id: workspaceId,
      status: "active",
    }).select("_id");

    if (!workspace) {
      return res.status(404).json({
        success: false,
        message: "Workspace not found",
      });
    }

    // Verify the current user belongs to this workspace.
    const currentMembership = await WorkspaceMember.findOne({
      workspace: workspace._id,
      user: req.user._id,
      status: "active",
    });

    if (
      !currentMembership ||
      !["owner", "admin", "manager"].includes(currentMembership.role)
    ) {
      return res.status(403).json({
        success: false,
        message: "You do not have permission to view workspace members",
      });
    }

    const members = await WorkspaceMember.find({
      workspace: workspace._id,
      status: { $ne: "suspended" },
    })
      .select("user role status joinedAt createdAt")
      .populate({
        path: "user",
        select: "name email status",
      })
      .sort({ createdAt: -1 })
      .lean();

    const data = members
      .filter((member) => member.user && member.user.status === "active")
      .map((member) => ({
        membershipId: member._id,
        user: {
          id: member.user._id,
          name: member.user.name,
          email: member.user.email,
        },
        role: member.role,
        status: member.status,
        joinedAt: member.joinedAt,
      }));

    return res.status(200).json({
      success: true,
      count: data.length,
      data: { members: data },
    });
  } catch (error) {
    next(error);
  }
};

export const deleteWorkspace = async (req, res, next) => {
  try {
    const { workspaceId } = req.params;

    if (!mongoose.isValidObjectId(workspaceId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid workspace ID",
      });
    }

    const workspace = await Workspace.findOne({
      _id: workspaceId,
      status: "active",
    });

    if (!workspace) {
      return res.status(404).json({
        success: false,
        message: "Workspace not found",
      });
    }

    // Only the workspace owner can archive it.
    if (workspace.createdBy.toString() !== req.user._id.toString()) {
      return res.status(403).json({
        success: false,
        message: "Only the workspace owner can delete this workspace",
      });
    }

    workspace.status = "archived";
    await workspace.save();

    return res.status(200).json({
      success: true,
      message: "Workspace archived successfully",
    });
  } catch (error) {
    next(error);
  }
};

export const removeWorkspaceMember = async (req, res, next) => {
  try {
    const { workspaceId, userId } = req.params;

    // 1. Validate IDs
    if (
      !mongoose.isValidObjectId(workspaceId) ||
      !mongoose.isValidObjectId(userId)
    ) {
      return res.status(400).json({
        success: false,
        message: "Invalid workspace or user ID",
      });
    }

    // 2. Find active workspace
    const workspace = await Workspace.findOne({
      _id: workspaceId,
      status: "active",
    });

    if (!workspace) {
      return res.status(404).json({
        success: false,
        message: "Workspace not found",
      });
    }

    // 3. Only the workspace owner can remove members
    if (workspace.createdBy.toString() !== req.user._id.toString()) {
      return res.status(403).json({
        success: false,
        message: "Only the workspace owner can remove members",
      });
    }

    // 4. Prevent the owner from removing themselves
    if (userId === req.user._id.toString()) {
      return res.status(400).json({
        success: false,
        message: "You cannot remove yourself as the workspace owner",
      });
    }

    // 5. Find active membership
    const membership = await WorkspaceMember.findOne({
      workspace: workspaceId,
      user: userId,
      status: "active",
    });

    if (!membership) {
      return res.status(404).json({
        success: false,
        message: "Active workspace membership not found",
      });
    }

    // 6. Suspend membership instead of deleting the record
    membership.status = "suspended";
    await membership.save();

    // 7. Remove the user's active project memberships too
    await ProjectMember.updateMany(
      {
        workspace: workspaceId,
        user: userId,
        status: "active",
      },
      {
        $set: { status: "removed" },
      },
    );

    return res.status(200).json({
      success: true,
      message: "Workspace member removed successfully",
    });
  } catch (error) {
    next(error);
  }
};
