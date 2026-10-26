import { describe, it, expect } from "vitest";
import request from "supertest";
import app from "../app.js";
import { registerUser, createWorkspace, addWorkspaceMember } from "./helpers.js";

describe("Workspace endpoints (/api/workspaces)", () => {
  it("POST /create-workspace requires authentication", async () => {
    const response = await request(app).post("/api/workspaces/create-workspace").send({ name: "My Workspace", slug: "my-workspace" });
    expect(response.status).toBe(401);
  });

  it("POST /create-workspace creates a workspace and owner membership", async () => {
    const { agent } = await registerUser();
    const workspace = await createWorkspace(agent);
    expect(workspace.name).toContain("Test Workspace");
    const response = await agent.get("/api/workspaces/my-workspaces");
    expect(response.status).toBe(200);
    expect(response.body.data.workspaces).toHaveLength(1);
    expect(response.body.data.workspaces[0].role).toBe("owner");
  });

  it("POST /create-workspace rejects an invalid slug", async () => {
    const { agent } = await registerUser();
    const response = await agent.post("/api/workspaces/create-workspace").send({ name: "Workspace", slug: "Invalid Slug!" });
    expect(response.status).toBe(400);
  });

  it("GET /my-workspaces rejects unauthenticated requests", async () => {
    expect((await request(app).get("/api/workspaces/my-workspaces")).status).toBe(401);
  });

  it("GET /:workspaceId/members lists members for the owner", async () => {
    const owner = await registerUser();
    const employee = await registerUser();
    const workspace = await createWorkspace(owner.agent);
    expect((await addWorkspaceMember(owner.agent, workspace.id, employee.user)).status).toBe(201);
    const response = await owner.agent.get(`/api/workspaces/${workspace.id}/members`);
    expect(response.status).toBe(200);
    expect(response.body.data.members.length).toBe(2);
  });

  it("POST /:workspaceId/members rejects an unregistered email", async () => {
    const owner = await registerUser();
    const workspace = await createWorkspace(owner.agent);
    const response = await owner.agent.post(`/api/workspaces/${workspace.id}/members`).send({ email: "missing-user@example.test", role: "employee" });
    expect(response.status).toBe(404);
  });

  it("POST /:workspaceId/members rejects duplicate membership", async () => {
    const owner = await registerUser();
    const employee = await registerUser();
    const workspace = await createWorkspace(owner.agent);
    expect((await addWorkspaceMember(owner.agent, workspace.id, employee.user)).status).toBe(201);
    expect((await addWorkspaceMember(owner.agent, workspace.id, employee.user)).status).toBe(409);
  });

  it("DELETE /:workspaceId/members/:userId removes a member and blocks future access", async () => {
    const owner = await registerUser();
    const employee = await registerUser();
    const workspace = await createWorkspace(owner.agent);
    expect((await addWorkspaceMember(owner.agent, workspace.id, employee.user)).status).toBe(201);
    const remove = await owner.agent.delete(`/api/workspaces/${workspace.id}/members/${employee.user.id}`);
    expect(remove.status).toBe(200);
    const dashboard = await employee.agent.get(`/api/dashboard/workspaces/${workspace.id}`);
    expect(dashboard.status).toBe(403);
  });

  it("DELETE /:workspaceId/members/:userId rejects removal by a non-owner", async () => {
    const owner = await registerUser();
    const employee = await registerUser();
    const workspace = await createWorkspace(owner.agent);
    expect((await addWorkspaceMember(owner.agent, workspace.id, employee.user)).status).toBe(201);
    const response = await employee.agent.delete(`/api/workspaces/${workspace.id}/members/${owner.user.id}`);
    expect(response.status).toBe(403);
  });

  it("DELETE /:workspaceId rejects deletion by a non-owner", async () => {
    const owner = await registerUser();
    const outsider = await registerUser();
    const workspace = await createWorkspace(owner.agent);
    const response = await outsider.agent.delete(`/api/workspaces/${workspace.id}`);
    expect(response.status).toBe(403);
  });

  it("DELETE /:workspaceId archives the workspace for its owner", async () => {
    const owner = await registerUser();
    const workspace = await createWorkspace(owner.agent);
    const response = await owner.agent.delete(`/api/workspaces/${workspace.id}`);
    expect(response.status).toBe(200);
    const list = await owner.agent.get("/api/workspaces/my-workspaces");
    expect(list.body.data.workspaces).toHaveLength(0);
  });
});
