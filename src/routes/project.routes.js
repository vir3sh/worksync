import { Router } from "express";
import {
  createProject,
  getWorkspaceProjects,
  addProjectMember,
  getProjectMembers,
  deleteProject,
  removeProjectMember,
} from "../controller/project.controller.js";
import authenticateUser from "../middleware/auth.middleware.js";
import {
  createTask,
  deleteTask,
  getProjectTasks,
  getTaskById,
  updateTask,
  updateTaskStatus,
} from "../controller/task.controller.js";
import { getTaskActivity } from "../controller/task-activity.controller.js";

const projectRouter = Router();

projectRouter.post("/:workspaceId/projects", authenticateUser, createProject);
projectRouter.delete(
  "/:workspaceId/projects/:projectId",
  authenticateUser,
  deleteProject,
);

projectRouter.delete(
  "/:workspaceId/projects/:projectId/members/:userId",
  authenticateUser,
  removeProjectMember,
);

projectRouter.get(
  "/:workspaceId/projects",
  authenticateUser,
  getWorkspaceProjects,
);

projectRouter.post(
  "/:workspaceId/projects/:projectId/members",
  authenticateUser,
  addProjectMember,
);

projectRouter.get(
  "/:workspaceId/projects/:projectId/members",
  authenticateUser,
  getProjectMembers,
);

// Task routes

projectRouter.post(
  "/:workspaceId/projects/:projectId/tasks",
  authenticateUser,
  createTask,
);

projectRouter.get(
  "/:workspaceId/projects/:projectId/tasks",
  authenticateUser,
  getProjectTasks,
);

projectRouter.patch(
  "/:workspaceId/projects/:projectId/tasks/:taskId/status",
  authenticateUser,
  updateTaskStatus,
);

projectRouter.patch(
  "/:workspaceId/projects/:projectId/tasks/:taskId",
  authenticateUser,
  updateTask,
);

projectRouter.delete(
  "/:workspaceId/projects/:projectId/tasks/:taskId",
  authenticateUser,
  deleteTask,
);

projectRouter.get(
  "/:workspaceId/projects/:projectId/tasks/:taskId",
  authenticateUser,
  getTaskById,
);

projectRouter.get(
  "/:workspaceId/projects/:projectId/tasks/:taskId/activity",
  authenticateUser,
  getTaskActivity,
);
export default projectRouter;
