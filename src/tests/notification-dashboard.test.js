import { describe, it, expect } from "vitest";
import Notification from "../models/notification.model.js";
import { createProjectFixture, createTask } from "./helpers.js";

describe("Notification endpoints (/api/notifications)", () => {
  it("GET / lists only the current user's notifications and unread count", async () => {
    const fixture = await createProjectFixture();
    const task = await createTask(fixture.owner.agent, fixture.workspace.id, fixture.project._id, { assignedTo: fixture.employee.user.id });
    const response = await fixture.employee.agent.get("/api/notifications");
    expect(response.status).toBe(200);
    expect(response.body.data.some((n) => n.task?._id === task._id || n.task === task._id)).toBe(true);
    expect(response.body.unreadCount).toBeGreaterThanOrEqual(1);
  });

  it("PATCH /:notificationId/read marks the recipient's notification as read", async () => {
    const fixture = await createProjectFixture();
    const task = await createTask(fixture.owner.agent, fixture.workspace.id, fixture.project._id, { assignedTo: fixture.employee.user.id });
    const notification = await Notification.findOne({ recipient: fixture.employee.user.id, task: task._id });
    const response = await fixture.employee.agent.patch(`/api/notifications/${notification._id}/read`);
    expect(response.status).toBe(200);
    expect((await Notification.findById(notification._id)).isRead).toBe(true);
  });

  it("PATCH /:notificationId/read does not let another user mark it read", async () => {
    const fixture = await createProjectFixture();
    const task = await createTask(fixture.owner.agent, fixture.workspace.id, fixture.project._id, { assignedTo: fixture.employee.user.id });
    const notification = await Notification.findOne({ recipient: fixture.employee.user.id, task: task._id });
    const response = await fixture.owner.agent.patch(`/api/notifications/${notification._id}/read`);
    expect(response.status).toBe(404);
  });

  it("PATCH /read-all marks all recipient notifications as read", async () => {
    const fixture = await createProjectFixture();
    await createTask(fixture.owner.agent, fixture.workspace.id, fixture.project._id, { assignedTo: fixture.employee.user.id });
    const response = await fixture.employee.agent.patch("/api/notifications/read-all");
    expect(response.status).toBe(200);
    expect(response.body.updatedCount).toBeGreaterThanOrEqual(1);
    expect(await Notification.countDocuments({ recipient: fixture.employee.user.id, isRead: false })).toBe(0);
  });
});

describe("Dashboard endpoint (/api/dashboard)", () => {
  it("GET /workspaces/:workspaceId returns project and task statistics", async () => {
    const fixture = await createProjectFixture();
    await createTask(fixture.owner.agent, fixture.workspace.id, fixture.project._id, { assignedTo: fixture.employee.user.id });
    const response = await fixture.owner.agent.get(`/api/dashboard/workspaces/${fixture.workspace.id}`);
    expect(response.status).toBe(200);
    expect(response.body.data.projects.total).toBe(1);
    expect(response.body.data.tasks.total).toBe(1);
    expect(response.body.data.tasks.assignedToMe).toBe(0);
  });

  it("GET /workspaces/:workspaceId denies a non-member", async () => {
    const fixture = await createProjectFixture();
    const response = await fixture.outsider.agent.get(`/api/dashboard/workspaces/${fixture.workspace.id}`);
    expect(response.status).toBe(403);
  });
});
