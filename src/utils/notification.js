import Notification from "../models/notification.model.js";

export const createNotification = async ({
  workspaceId,
  recipientId,
  actorId,
  type,
  title,
  message,
  taskId = null,
}) => {
  if (recipientId.toString() === actorId.toString()) {
    return null;
  }

  return Notification.create({
    workspace: workspaceId,
    recipient: recipientId,
    actor: actorId,
    type,
    title,
    message,
    task: taskId,
  });
};
