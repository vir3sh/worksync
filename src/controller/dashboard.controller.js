import mongoose from "mongoose";
import Workspace from "../models/workspace.model.js";
import WorkspaceMember from "../models/workspace-member.model.js";
import Project from "../models/project.model.js";
import Task from "../models/task.model.js";

export const getWorkspaceDashboard = async (req, res, next) => {
  try {
    const { workspaceId } = req.params;

    if (!mongoose.isValidObjectId(workspaceId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid workspace ID",
      });
    }

    // 1. Verify workspace is active
    const workspace = await Workspace.findOne({
      _id: workspaceId,
      status: "active",
    }).select("_id name");

    if (!workspace) {
      return res.status(404).json({
        success: false,
        message: "Workspace not found",
      });
    }

    // 2. Verify current user is an active member
    const membership = await WorkspaceMember.findOne({
      workspace: workspaceId,
      user: req.user._id,
      status: "active",
    }).select("role");

    if (!membership) {
      return res.status(403).json({
        success: false,
        message: "You are not an active workspace member",
      });
    }

    const projectFilter = {
      workspace: workspaceId,
      status: { $ne: "archived" },
    };

    const taskFilter = {
      workspace: workspaceId,
      deletedAt: null,
    };

    // Employees see their own task counts; managers see workspace-wide counts.
    const isManager = ["owner", "admin", "manager"].includes(membership.role);

    if (!isManager) {
      taskFilter.assignedTo = req.user._id;
    }

    const now = new Date();

    // 3. Fetch dashboard counts in parallel
    const [
      totalProjects,
      activeProjects,
      totalTasks,
      completedTasks,
      overdueTasks,
      assignedTasks,
    ] = await Promise.all([
      Project.countDocuments(projectFilter),

      Project.countDocuments({
        ...projectFilter,
        status: "active",
      }),

      Task.countDocuments(taskFilter),

      Task.countDocuments({
        ...taskFilter,
        status: "completed",
      }),

      Task.countDocuments({
        ...taskFilter,
        status: { $nin: ["completed"] },
        dueDate: { $lt: now, $ne: null },
      }),

      Task.countDocuments({
        ...taskFilter,
        assignedTo: req.user._id,
      }),
    ]);

    return res.status(200).json({
      success: true,
      data: {
        workspace,
        projects: {
          total: totalProjects,
          active: activeProjects,
        },
        tasks: {
          total: totalTasks,
          completed: completedTasks,
          overdue: overdueTasks,
          assignedToMe: assignedTasks,
        },
      },
    });
  } catch (error) {
    next(error);
  }
};
