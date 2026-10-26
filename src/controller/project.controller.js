import mongoose from "mongoose";
import Project from "../models/project.model.js";
import Workspace from "../models/workspace.model.js";
import WorkspaceMember from "../models/workspace-member.model.js";
import { createProjectValidation } from "../schema/project.schema.js";
import ProjectMember from "../models/project-member.model.js";
import { addProjectMemberValidation } from "../schema/project-member.schema.js";

export const createProject = async (req, res, next) => {
  try {
    const validation = createProjectValidation.safeParse(req.body);

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

    // Check the logged-in user's workspace membership and role.
    const membership = await WorkspaceMember.findOne({
      workspace: workspace._id,
      user: req.user._id,
      status: "active",
    });

    if (
      !membership ||
      !["owner", "admin", "manager"].includes(membership.role)
    ) {
      return res.status(403).json({
        success: false,
        message: "You do not have permission to create projects",
      });
    }

    const project = await Project.create({
      ...validation.data,
      workspace: workspace._id,
      createdBy: req.user._id,
    });

    return res.status(201).json({
      success: true,
      message: "Project created successfully",
      data: { project },
    });
  } catch (error) {
    next(error);
  }
};

export const getWorkspaceProjects = async (req, res, next) => {
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

    // Only active members of this workspace can list its projects.
    const membership = await WorkspaceMember.exists({
      workspace: workspace._id,
      user: req.user._id,
      status: "active",
    });

    if (!membership) {
      return res.status(403).json({
        success: false,
        message: "You do not have access to this workspace",
      });
    }

    const projects = await Project.find({
      workspace: workspace._id,
      status: { $ne: "archived" },
    })
      .populate("createdBy", "name email")
      .sort({ createdAt: -1 })
      .lean();

    return res.status(200).json({
      success: true,
      count: projects.length,
      data: { projects },
    });
  } catch (error) {
    next(error);
  }
};

export const addProjectMember = async (req, res, next) => {
  try {
    const validation = addProjectMemberValidation.safeParse(req.body);

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

    const { workspaceId, projectId } = req.params;
    const { userId, role } = validation.data;

    if (
      !mongoose.isValidObjectId(workspaceId) ||
      !mongoose.isValidObjectId(projectId)
    ) {
      return res.status(400).json({
        success: false,
        message: "Invalid workspace or project ID",
      });
    }

    // Confirm the logged-in user can manage projects.
    const currentMembership = await WorkspaceMember.findOne({
      workspace: workspaceId,
      user: req.user._id,
      status: "active",
    });

    if (
      !currentMembership ||
      !["owner", "admin", "manager"].includes(currentMembership.role)
    ) {
      return res.status(403).json({
        success: false,
        message: "You cannot manage project members",
      });
    }

    // Ensure the project belongs to this workspace.
    const project = await Project.findOne({
      _id: projectId,
      workspace: workspaceId,
      status: { $ne: "archived" },
    }).select("_id workspace");

    if (!project) {
      return res.status(404).json({
        success: false,
        message: "Project not found in this workspace",
      });
    }

    // The assigned user must be an active member of the same workspace.
    const targetMembership = await WorkspaceMember.findOne({
      workspace: workspaceId,
      user: userId,
      status: "active",
    }).populate("user", "_id name email status");

    if (
      !targetMembership ||
      !targetMembership.user ||
      targetMembership.user.status !== "active"
    ) {
      return res.status(400).json({
        success: false,
        message: "User is not an active member of this workspace",
      });
    }

    const existingMember = await ProjectMember.findOne({
      project: project._id,
      user: userId,
    });

    if (existingMember?.status === "active") {
      return res.status(409).json({
        success: false,
        message: "User is already assigned to this project",
      });
    }

    let projectMember;

    if (existingMember) {
      // Reactivate an existing membership instead of duplicating it.
      existingMember.workspace = workspaceId;
      existingMember.role = role;
      existingMember.status = "active";
      existingMember.addedBy = req.user._id;

      projectMember = await existingMember.save();
    } else {
      projectMember = await ProjectMember.create({
        project: project._id,
        workspace: workspaceId,
        user: userId,
        role,
        addedBy: req.user._id,
        status: "active",
      });
    }

    return res.status(201).json({
      success: true,
      message: "Project member added successfully",
      data: {
        member: {
          id: projectMember._id,
          user: {
            id: targetMembership.user._id,
            name: targetMembership.user.name,
            email: targetMembership.user.email,
          },
          role: projectMember.role,
          status: projectMember.status,
        },
      },
    });
  } catch (error) {
    if (error.code === 11000) {
      return res.status(409).json({
        success: false,
        message: "Project membership already exists",
      });
    }

    next(error);
  }
};

export const getProjectMembers = async (req, res, next) => {
  try {
    const { workspaceId, projectId } = req.params;

    if (
      !mongoose.isValidObjectId(workspaceId) ||
      !mongoose.isValidObjectId(projectId)
    ) {
      return res.status(400).json({
        success: false,
        message: "Invalid workspace or project ID",
      });
    }

    // Verify the user belongs to this workspace.
    const membership = await WorkspaceMember.findOne({
      workspace: workspaceId,
      user: req.user._id,
      status: "active",
    });

    if (!membership) {
      return res.status(403).json({
        success: false,
        message: "You do not have access to this workspace",
      });
    }

    // Ensure the project belongs to the specified workspace.
    const project = await Project.findOne({
      _id: projectId,
      workspace: workspaceId,
      status: { $ne: "archived" },
    }).select("_id");

    if (!project) {
      return res.status(404).json({
        success: false,
        message: "Project not found in this workspace",
      });
    }

    const projectMembers = await ProjectMember.find({
      project: project._id,
      workspace: workspaceId,
      status: "active",
    })
      .populate({
        path: "user",
        select: "name email status",
      })
      .sort({ createdAt: -1 })
      .lean();

    const members = projectMembers
      .filter((member) => member.user && member.user.status === "active")
      .map((member) => ({
        id: member._id,
        user: {
          id: member.user._id,
          name: member.user.name,
          email: member.user.email,
        },
        role: member.role,
        assignedAt: member.createdAt,
      }));

    return res.status(200).json({
      success: true,
      count: members.length,
      data: { members },
    });
  } catch (error) {
    next(error);
  }
};

export const deleteProject = async (req, res, next) => {
  try {
    const { workspaceId, projectId } = req.params;

    if (
      !mongoose.isValidObjectId(workspaceId) ||
      !mongoose.isValidObjectId(projectId)
    ) {
      return res.status(400).json({
        success: false,
        message: "Invalid workspace or project ID",
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

    const membership = await WorkspaceMember.findOne({
      workspace: workspaceId,
      user: req.user._id,
      status: "active",
    });

    if (
      !membership ||
      !["owner", "admin", "manager"].includes(membership.role)
    ) {
      return res.status(403).json({
        success: false,
        message: "You do not have permission to archive projects",
      });
    }

    const project = await Project.findOne({
      _id: projectId,
      workspace: workspaceId,
      status: { $ne: "archived" },
    });

    if (!project) {
      return res.status(404).json({
        success: false,
        message: "Project not found",
      });
    }

    project.status = "archived";
    await project.save();

    return res.status(200).json({
      success: true,
      message: "Project archived successfully",
    });
  } catch (error) {
    next(error);
  }
};

export const removeProjectMember = async (req, res, next) => {
  try {
    const { workspaceId, projectId, userId } = req.params;

    // Validate IDs
    if (
      !mongoose.isValidObjectId(workspaceId) ||
      !mongoose.isValidObjectId(projectId) ||
      !mongoose.isValidObjectId(userId)
    ) {
      return res.status(400).json({
        success: false,
        message: "Invalid workspace, project, or user ID",
      });
    }

    // Check workspace
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

    // Check requester membership and permissions
    const requesterMembership = await WorkspaceMember.findOne({
      workspace: workspaceId,
      user: req.user._id,
      status: "active",
    });

    if (
      !requesterMembership ||
      !["owner", "admin", "manager"].includes(requesterMembership.role)
    ) {
      return res.status(403).json({
        success: false,
        message: "You do not have permission to remove project members",
      });
    }

    // Check project belongs to this workspace
    const project = await Project.findOne({
      _id: projectId,
      workspace: workspaceId,
      status: { $ne: "archived" },
    });

    if (!project) {
      return res.status(404).json({
        success: false,
        message: "Project not found",
      });
    }

    // Mark membership as removed
    const membership = await ProjectMember.findOneAndUpdate(
      {
        project: projectId,
        workspace: workspaceId,
        user: userId,
        status: "active",
      },
      {
        $set: { status: "removed" },
      },
      { returnDocument: "after" },
    );

    if (!membership) {
      return res.status(404).json({
        success: false,
        message: "Active project membership not found",
      });
    }

    return res.status(200).json({
      success: true,
      message: "User removed from project successfully",
    });
  } catch (error) {
    next(error);
  }
};
