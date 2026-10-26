import TaskActivity from "../models/task-activity.model.js";

export const logTaskActivity = async ({
  workspaceId,
  projectId,
  taskId,
  actorId,
  action,
  details = {},
}) => {
  return TaskActivity.create({
    workspace: workspaceId,
    project: projectId,
    task: taskId,
    actor: actorId,
    action,
    details,
  });
};
