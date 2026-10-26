import { describe, it, expect } from "vitest";
import { createProjectFixture, createTask } from "./helpers.js";

describe("Task endpoints (/api/projects/:workspaceId/projects/:projectId/tasks)", () => {
  it("POST creates a task and records activity/assignment notification", async () => {
    const fixture = await createProjectFixture();
    const task = await createTask(fixture.owner.agent, fixture.workspace.id, fixture.project._id, { assignedTo: fixture.employee.user.id, priority: "high" });
    expect(task.title).toBe("Test Task");
    expect(task.status).toBe("todo");

    const activity = await fixture.owner.agent.get(`/api/projects/${fixture.workspace.id}/projects/${fixture.project._id}/tasks/${task._id}/activity`);
    expect(activity.status).toBe(200);
    expect(activity.body.data.some((entry) => entry.action === "created")).toBe(true);

    const notifications = await fixture.employee.agent.get("/api/notifications");
    expect(notifications.status).toBe(200);
    expect(notifications.body.data.some((entry) => entry.type === "task_assigned")).toBe(true);
  });

  it("POST rejects invalid task data", async () => {
    const fixture = await createProjectFixture();
    const response = await fixture.owner.agent.post(`/api/projects/${fixture.workspace.id}/projects/${fixture.project._id}/tasks`).send({ title: "x" });
    expect(response.status).toBe(400);
  });

  it("POST rejects an assignee who is not a project member", async () => {
    const fixture = await createProjectFixture();
    const response = await fixture.owner.agent.post(`/api/projects/${fixture.workspace.id}/projects/${fixture.project._id}/tasks`).send({ title: "A valid task", assignedTo: fixture.outsider.user.id });
    expect(response.status).toBe(400);
  });

  it("GET lists tasks and supports filters/pagination", async () => {
    const fixture = await createProjectFixture();
    await createTask(fixture.owner.agent, fixture.workspace.id, fixture.project._id, { priority: "high" });
    const response = await fixture.owner.agent.get(`/api/projects/${fixture.workspace.id}/projects/${fixture.project._id}/tasks?priority=high&page=1&limit=5`);
    expect(response.status).toBe(200);
    expect(response.body.data).toHaveLength(1);
    expect(response.body.pagination.page).toBe(1);
  });

  it("GET rejects an invalid status filter", async () => {
    const fixture = await createProjectFixture();
    const response = await fixture.owner.agent.get(`/api/projects/${fixture.workspace.id}/projects/${fixture.project._id}/tasks?status=not-a-status`);
    expect(response.status).toBe(400);
  });

  it("GET /:taskId returns task details", async () => {
    const fixture = await createProjectFixture();
    const task = await createTask(fixture.owner.agent, fixture.workspace.id, fixture.project._id);
    const response = await fixture.owner.agent.get(`/api/projects/${fixture.workspace.id}/projects/${fixture.project._id}/tasks/${task._id}`);
    expect(response.status).toBe(200);
    expect(response.body.data._id).toBe(task._id);
  });

  it("PATCH /:taskId/status updates task status", async () => {
    const fixture = await createProjectFixture();
    const task = await createTask(fixture.owner.agent, fixture.workspace.id, fixture.project._id);
    const response = await fixture.owner.agent.patch(`/api/projects/${fixture.workspace.id}/projects/${fixture.project._id}/tasks/${task._id}/status`).send({ status: "in-progress" });
    expect(response.status).toBe(200);
    expect(response.body.data.status).toBe("in-progress");
  });

  it("PATCH /:taskId updates task details", async () => {
    const fixture = await createProjectFixture();
    const task = await createTask(fixture.owner.agent, fixture.workspace.id, fixture.project._id);
    const response = await fixture.owner.agent.patch(`/api/projects/${fixture.workspace.id}/projects/${fixture.project._id}/tasks/${task._id}`).send({ title: "Updated task title", priority: "urgent" });
    expect(response.status).toBe(200);
    expect(response.body.data.title).toBe("Updated task title");
    expect(response.body.data.priority).toBe("urgent");
  });

  it("PATCH /:taskId rejects an empty update", async () => {
    const fixture = await createProjectFixture();
    const task = await createTask(fixture.owner.agent, fixture.workspace.id, fixture.project._id);
    const response = await fixture.owner.agent.patch(`/api/projects/${fixture.workspace.id}/projects/${fixture.project._id}/tasks/${task._id}`).send({});
    expect(response.status).toBe(400);
  });

  it("DELETE /:taskId soft-deletes a task and hides it from detail lookup", async () => {
    const fixture = await createProjectFixture();
    const task = await createTask(fixture.owner.agent, fixture.workspace.id, fixture.project._id);
    const url = `/api/projects/${fixture.workspace.id}/projects/${fixture.project._id}/tasks/${task._id}`;
    expect((await fixture.owner.agent.delete(url)).status).toBe(200);
    expect((await fixture.owner.agent.get(url)).status).toBe(404);
  });
});
