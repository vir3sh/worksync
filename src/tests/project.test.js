import { describe, it, expect } from "vitest";
import request from "supertest";
import app from "../app.js";
import { registerUser, createWorkspace, createProject, addWorkspaceMember, addProjectMember, createProjectFixture } from "./helpers.js";

describe("Project endpoints (/api/projects)", () => {
  it("POST /:workspaceId/projects creates a project for an owner", async () => {
    const owner = await registerUser();
    const workspace = await createWorkspace(owner.agent);
    const project = await createProject(owner.agent, workspace.id);
    expect(project.name).toBe("Test Project");
    expect(project.workspace.toString()).toBe(workspace.id.toString());
  });

  it("POST /:workspaceId/projects rejects unauthenticated requests", async () => {
    const owner = await registerUser();
    const workspace = await createWorkspace(owner.agent);
    const response = await request(app).post(`/api/projects/${workspace.id}/projects`).send({ name: "Project" });
    expect(response.status).toBe(401);
  });

  it("POST /:workspaceId/projects rejects invalid project input", async () => {
    const owner = await registerUser();
    const workspace = await createWorkspace(owner.agent);
    const response = await owner.agent.post(`/api/projects/${workspace.id}/projects`).send({ name: "x" });
    expect(response.status).toBe(400);
  });

  it("GET /:workspaceId/projects lists projects for a workspace member", async () => {
    const owner = await registerUser();
    const workspace = await createWorkspace(owner.agent);
    await createProject(owner.agent, workspace.id);
    const response = await owner.agent.get(`/api/projects/${workspace.id}/projects`);
    expect(response.status).toBe(200);
    expect(response.body.data.projects).toHaveLength(1);
  });

  it("GET /:workspaceId/projects denies a non-member", async () => {
    const owner = await registerUser();
    const outsider = await registerUser();
    const workspace = await createWorkspace(owner.agent);
    expect((await outsider.agent.get(`/api/projects/${workspace.id}/projects`)).status).toBe(403);
  });

  it("POST /:workspaceId/projects/:projectId/members adds a workspace member", async () => {
    const fixture = await createProjectFixture();
    const members = await fixture.owner.agent.get(`/api/projects/${fixture.workspace.id}/projects/${fixture.project._id}/members`);
    expect(members.status).toBe(200);
    expect(members.body.data.members.length).toBeGreaterThanOrEqual(1);
  });

  it("POST /:workspaceId/projects/:projectId/members rejects duplicate membership", async () => {
    const fixture = await createProjectFixture();
    const response = await addProjectMember(fixture.owner.agent, fixture.workspace.id, fixture.project._id, fixture.employee.user.id);
    expect(response.status).toBe(409);
  });

  it("POST /:workspaceId/projects/:projectId/members rejects a user outside the workspace", async () => {
    const fixture = await createProjectFixture();
    const response = await addProjectMember(fixture.owner.agent, fixture.workspace.id, fixture.project._id, fixture.outsider.user.id);
    expect(response.status).toBe(400);
  });

  it("DELETE /:workspaceId/projects/:projectId/members/:userId removes a project member", async () => {
    const fixture = await createProjectFixture();
    const response = await fixture.owner.agent.delete(`/api/projects/${fixture.workspace.id}/projects/${fixture.project._id}/members/${fixture.employee.user.id}`);
    expect(response.status).toBe(200);
  });

  it("DELETE /:workspaceId/projects/:projectId archives a project", async () => {
    const owner = await registerUser();
    const workspace = await createWorkspace(owner.agent);
    const project = await createProject(owner.agent, workspace.id);
    const response = await owner.agent.delete(`/api/projects/${workspace.id}/projects/${project._id}`);
    expect(response.status).toBe(200);
    const list = await owner.agent.get(`/api/projects/${workspace.id}/projects`);
    expect(list.body.data.projects).toHaveLength(0);
  });
});
