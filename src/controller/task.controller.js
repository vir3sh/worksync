import mongoose from "mongoose";
import Task from "../models/task.model.js";
import Project from "../models/project.model.js";
import Workspace from "../models/workspace.model.js";
import WorkspaceMember from "../models/workspace-member.model.js";
import ProjectMember from "../models/project-member.model.js";
import {
  createTaskValidation,
  updateTaskStatusValidation,
  updateTaskValidation,
} from "../schema/task.schema.js";
import { logTaskActivity } from "../utils/task-activity.js";
import { createNotification } from "../utils/notification.js";
import Notification from "../models/notification.model.js";

export const createTask = async (req, res, next) => {
  try {
    const { workspaceId, projectId } = req.params;

    // 1. Validate URL parameters
    if (
      !mongoose.isValidObjectId(workspaceId) ||
      !mongoose.isValidObjectId(projectId)
    ) {
      return res.status(400).json({
        success: false,
        message: "Invalid workspace or project ID",
      });
    }

    // 2. Validate request body
    const validation = createTaskValidation.safeParse(req.body);

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

    const { title, description, assignedTo, priority, dueDate } =
      validation.data;

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

    // 4. Check requester is an active workspace member
    const requesterMembership = await WorkspaceMember.findOne({
      workspace: workspaceId,
      user: req.user._id,
      status: "active",
    });

    if (!requesterMembership) {
      return res.status(403).json({
        success: false,
        message: "You are not an active member of this workspace",
      });
    }

    // 5. Only owner, admin, or manager can create tasks
    if (!["owner", "admin", "manager"].includes(requesterMembership.role)) {
      return res.status(403).json({
        success: false,
        message: "You do not have permission to create tasks",
      });
    }

    // 6. Check project belongs to workspace and is not archived
    const project = await Project.findOne({
      _id: projectId,
      workspace: workspaceId,
      status: { $ne: "archived" },
    });

    if (!project) {
      return res.status(404).json({
        success: false,
        message: "Project not found in this workspace",
      });
    }

    // 7. If assigned, verify the user belongs to the workspace and project
    if (assignedTo) {
      const workspaceMembership = await WorkspaceMember.findOne({
        workspace: workspaceId,
        user: assignedTo,
        status: "active",
      });

      if (!workspaceMembership) {
        return res.status(400).json({
          success: false,
          message: "Assignee is not an active workspace member",
        });
      }

      const projectMembership = await ProjectMember.findOne({
        workspace: workspaceId,
        project: projectId,
        user: assignedTo,
        status: "active",
      });

      if (!projectMembership) {
        return res.status(400).json({
          success: false,
          message: "Assignee is not an active member of this project",
        });
      }
    }

    // 8. Create task using trusted server-side values
    const task = await Task.create({
      title,
      description,
      assignedTo,
      priority,
      dueDate,
      workspace: workspaceId,
      project: projectId,
      createdBy: req.user._id,
      status: "todo",
    });
    // After creating and saving the task

    await logTaskActivity({
      workspaceId,
      projectId,
      taskId: task._id,
      actorId: req.user._id,
      action: "created",
      details: {
        title: task.title,
        priority: task.priority,
        assignedTo: task.assignedTo,
      },
    });
    if (task.assignedTo) {
      await createNotification({
        workspaceId,
        recipientId: task.assignedTo,
        actorId: req.user._id,
        type: "task_assigned",
        title: "New task assigned",
        message: `You have been assigned: ${task.title}`,
        taskId: task._id,
      });
    }

    return res.status(201).json({
      success: true,
      message: "Task created successfully",
      data: task,
    });
  } catch (error) {
    next(error);
  }
};

export const getProjectTasks = async (req, res, next) => {
  try {
    const { workspaceId, projectId } = req.params;
    const { status, priority, page = "1", limit = "10" } = req.query;

    // 1. Validate IDs
    if (
      !mongoose.isValidObjectId(workspaceId) ||
      !mongoose.isValidObjectId(projectId)
    ) {
      return res.status(400).json({
        success: false,
        message: "Invalid workspace or project ID",
      });
    }

    // 2. Validate pagination
    const pageNumber = Number(page);
    const limitNumber = Number(limit);

    if (
      !Number.isInteger(pageNumber) ||
      !Number.isInteger(limitNumber) ||
      pageNumber < 1 ||
      limitNumber < 1 ||
      limitNumber > 100
    ) {
      return res.status(400).json({
        success: false,
        message: "Invalid pagination values",
      });
    }

    // 3. Validate filters
    const allowedStatuses = ["todo", "in-progress", "in-review", "completed"];
    const allowedPriorities = ["low", "medium", "high", "urgent"];

    if (status && !allowedStatuses.includes(status)) {
      return res.status(400).json({
        success: false,
        message: "Invalid task status",
      });
    }

    if (priority && !allowedPriorities.includes(priority)) {
      return res.status(400).json({
        success: false,
        message: "Invalid task priority",
      });
    }

    // 4. Check active workspace
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

    // 5. Check active workspace membership
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

    // 6. Check project
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

    // 7. Check project membership for all users
    const projectMembership = await ProjectMember.findOne({
      workspace: workspaceId,
      project: projectId,
      user: req.user._id,
      status: "active",
    });

    const isPrivileged = ["owner", "admin", "manager"].includes(
      membership.role,
    );

    if (!isPrivileged && !projectMembership) {
      return res.status(403).json({
        success: false,
        message: "You are not an active member of this project",
      });
    }

    // 8. Build query
    const filter = {
      workspace: workspaceId,
      project: projectId,
      deletedAt: null,
    };

    // Regular employees only see their assigned tasks
    if (!isPrivileged) {
      filter.assignedTo = req.user._id;
    }

    if (status) filter.status = status;
    if (priority) filter.priority = priority;

    // 9. Fetch paginated tasks
    const [tasks, total] = await Promise.all([
      Task.find(filter)
        .populate("assignedTo", "name email")
        .populate("createdBy", "name email")
        .sort({ createdAt: -1 })
        .skip((pageNumber - 1) * limitNumber)
        .limit(limitNumber)
        .lean(),

      Task.countDocuments(filter),
    ]);

    return res.status(200).json({
      success: true,
      data: tasks,
      pagination: {
        total,
        page: pageNumber,
        limit: limitNumber,
        totalPages: Math.ceil(total / limitNumber),
      },
    });
  } catch (error) {
    next(error);
  }
};

export const updateTaskStatus = async (req, res, next) => {
  try {
    const { workspaceId, projectId, taskId } = req.params;

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

    // 2. Validate request body
    const validation = updateTaskStatusValidation.safeParse(req.body);

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

    // 3. Verify active workspace
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

    // 4. Verify workspace membership
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

    // 5. Verify project
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

    // 6. Find task inside this project and workspace
    const task = await Task.findOne({
      _id: taskId,
      project: projectId,
      workspace: workspaceId,
    });

    if (!task) {
      return res.status(404).json({
        success: false,
        message: "Task not found",
      });
    }

    // 7. Check permissions
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
          message: "You can only update tasks assigned to you",
        });
      }
    }

    const previousStatus = task.status;
    task.status = validation.data.status;
    await task.save();

    if (previousStatus !== task.status && task.assignedTo) {
      await createNotification({
        workspaceId,
        recipientId: task.assignedTo,
        actorId: req.user._id,
        type: "task_status_changed",
        title: "Task status updated",
        message: `The status of "${task.title}" changed to ${task.status}.`,
        taskId: task._id,
      });
    }

    await logTaskActivity({
      workspaceId,
      projectId,
      taskId: task._id,
      actorId: req.user._id,
      action: "status_changed",
      details: {
        newStatus: task.status,
      },
    });

    return res.status(200).json({
      success: true,
      message: "Task status updated successfully",
      data: {
        _id: task._id,
        title: task.title,
        status: task.status,
        updatedAt: task.updatedAt,
      },
    });
  } catch (error) {
    next(error);
  }
};

export const updateTask = async (req, res, next) => {
  try {
    const { workspaceId, projectId, taskId } = req.params;

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

    // 2. Validate body
    const validation = updateTaskValidation.safeParse(req.body);

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

    // 3. Verify workspace and membership
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

    if (!membership) {
      return res.status(403).json({
        success: false,
        message: "You are not an active workspace member",
      });
    }

    // 4. Verify project
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

    // 5. Only managers can edit task details
    if (!["owner", "admin", "manager"].includes(membership.role)) {
      return res.status(403).json({
        success: false,
        message: "You do not have permission to edit task details",
      });
    }

    // 6. Find task inside this project
    const task = await Task.findOne({
      _id: taskId,
      project: projectId,
      workspace: workspaceId,
    });

    if (!task) {
      return res.status(404).json({
        success: false,
        message: "Task not found",
      });
    }

    const updates = validation.data;

    // 7. If changing the assignee, verify active membership
    if (updates.assignedTo) {
      const workspaceMember = await WorkspaceMember.findOne({
        workspace: workspaceId,
        user: updates.assignedTo,
        status: "active",
      });

      if (!workspaceMember) {
        return res.status(400).json({
          success: false,
          message: "Assignee is not an active workspace member",
        });
      }

      const projectMember = await ProjectMember.findOne({
        workspace: workspaceId,
        project: projectId,
        user: updates.assignedTo,
        status: "active",
      });

      if (!projectMember) {
        return res.status(400).json({
          success: false,
          message: "Assignee is not an active project member",
        });
      }
    }

    // 8. Apply only fields supplied by the client

    const previousAssigneeId = task.assignedTo?.toString() || null;

    Object.assign(task, updates);
    await task.save();

    if (Object.prototype.hasOwnProperty.call(updates, "assignedTo")) {
      const newAssigneeId = task.assignedTo?.toString() || null;

      if (newAssigneeId !== previousAssigneeId && newAssigneeId) {
        await createNotification({
          workspaceId,
          recipientId: task.assignedTo,
          actorId: req.user._id,
          type: "task_reassigned",
          title: "Task assigned to you",
          message: `You have been assigned: ${task.title}`,
          taskId: task._id,
        });
      }

      if (previousAssigneeId && previousAssigneeId !== newAssigneeId) {
        await createNotification({
          workspaceId,
          recipientId: previousAssigneeId,
          actorId: req.user._id,
          type: "task_reassigned",
          title: "Task assignment changed",
          message: `The assignment for "${task.title}" has changed.`,
          taskId: task._id,
        });
      }
    }

    return res.status(200).json({
      success: true,
      message: "Task updated successfully",
      data: task,
    });
  } catch (error) {
    next(error);
  }
};

export const deleteTask = async (req, res, next) => {
  try {
    const { workspaceId, projectId, taskId } = req.params;

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

    // 2. Check workspace
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

    // 3. Check active workspace membership
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

    // 4. Only managers can delete tasks
    if (!["owner", "admin", "manager"].includes(membership.role)) {
      return res.status(403).json({
        success: false,
        message: "You do not have permission to delete tasks",
      });
    }

    // 5. Verify project
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

    // 6. Find and soft-delete the task
    const task = await Task.findOneAndUpdate(
      {
        _id: taskId,
        project: projectId,
        workspace: workspaceId,
        $or: [{ deletedAt: null }, { deletedAt: { $exists: false } }],
      },
      {
        $set: { deletedAt: new Date() },
      },
      {
        new: true,
        runValidators: true,
      },
    );

    if (!task) {
      return res.status(404).json({
        success: false,
        message:
          "Task not found, already deleted, or its workspace/project does not match",
      });
    }

    return res.status(200).json({
      success: true,
      message: "Task deleted successfully",
    });
  } catch (error) {
    next(error);
  }
};

export const getTaskById = async (req, res, next) => {
  try {
    const { workspaceId, projectId, taskId } = req.params;

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

    // 2. Verify workspace
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

    // 3. Verify active workspace membership
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

    // 4. Verify project
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

    // 5. Find task, excluding soft-deleted tasks
    const task = await Task.findOne({
      _id: taskId,
      workspace: workspaceId,
      project: projectId,
      deletedAt: null,
    })
      .populate("assignedTo", "name email")
      .populate("createdBy", "name email")
      .lean();

    if (!task) {
      return res.status(404).json({
        success: false,
        message: "Task not found",
      });
    }

    // 6. Managers can view all tasks.
    // Employees must be active project members and assigned to this task.
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
        task.assignedTo?._id?.toString() !== req.user._id.toString()
      ) {
        return res.status(403).json({
          success: false,
          message: "You do not have permission to view this task",
        });
      }
    }

    return res.status(200).json({
      success: true,
      data: task,
    });
  } catch (error) {
    next(error);
  }
};
