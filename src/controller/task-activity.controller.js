import mongoose from "mongoose";
import Task from "../models/task.model.js";
import Project from "../models/project.model.js";
import Workspace from "../models/workspace.model.js";
import WorkspaceMember from "../models/workspace-member.model.js";
import ProjectMember from "../models/project-member.model.js";
import TaskActivity from "../models/task-activity.model.js";

export const getTaskActivity = async (req, res, next) => {
  try {
    const { workspaceId, projectId, taskId } = req.params;
    const page = Number(req.query.page ?? 1);
    const limit = Number(req.query.limit ?? 20);

    // 1. Validate IDs
    if (
      !mongoose.isValidObjectId(workspaceId) ||
      !mongoose.isValidObjectId(projectId) ||
      !mongoose.isValidObjectId(taskId)
    ) {
      return res.status(400).json({
        success: false,
        message: "Invalid workspace, project, or task ID",
      });
    }

    // 2. Validate pagination
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

    // 3. Check workspace
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

    // 4. Check active workspace membership
    const membership = await WorkspaceMember.findOne({
      workspace: workspaceId,
      user: req.user._id,
      status: "active",
    });

    if (!membership) {
      return res.status(403).json({
        success: false,
        message: "You are not an active workspace member",
      });
    }

    // 5. Check project
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

    // 6. Check task
    const task = await Task.findOne({
      _id: taskId,
      workspace: workspaceId,
      project: projectId,
      deletedAt: null,
    });

    if (!task) {
      return res.status(404).json({
        success: false,
        message: "Task not found",
      });
    }

    // 7. Managers can see all task activity.
    // Employees must be active project members assigned to the task.
    const isManager = ["owner", "admin", "manager"].includes(membership.role);

    if (!isManager) {
      const projectMembership = await ProjectMember.findOne({
        workspace: workspaceId,
        project: projectId,
        user: req.user._id,
        status: "active",
      });

      if (
        !projectMembership ||
        task.assignedTo?.toString() !== req.user._id.toString()
      ) {
        return res.status(403).json({
          success: false,
          message: "You cannot view this task's activity",
        });
      }
    }

    // 8. Fetch activity history
    const filter = {
      workspace: workspaceId,
      project: projectId,
      task: taskId,
    };

    const [activities, total] = await Promise.all([
      TaskActivity.find(filter)
        .populate("actor", "name email")
        .sort({ createdAt: -1, _id: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .lean(),

      TaskActivity.countDocuments(filter),
    ]);

    return res.status(200).json({
      success: true,
      data: activities,
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
