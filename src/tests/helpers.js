import request from "supertest";
import app from "../app.js";

let sequence = 0;

export const uniqueEmail = (prefix = "user") => {
  sequence += 1;
  return `${prefix}-${Date.now()}-${sequence}@example.test`;
};

export async function registerUser(overrides = {}) {
  const agent = request.agent(app);
  const payload = {
    name: "WorkSync Test User",
    email: uniqueEmail(),
    password: "TestPassword123!",
    ...overrides,
  };

  const response = await agent.post("/api/users/register").send(payload);
  if (response.status !== 201) {
    throw new Error(
      `Test user registration failed (${response.status}): ${JSON.stringify(response.body)}`,
    );
  }

  return { agent, user: response.body.data.user, password: payload.password };
}

export async function createWorkspace(agent, overrides = {}) {
  sequence += 1;
  const suffix = `${Date.now()}-${sequence}`;
  const response = await agent.post("/api/workspaces/create-workspace").send({
    name: `Test Workspace ${suffix}`,
    slug: `test-workspace-${suffix}`.toLowerCase(),
    description: "Workspace created by automated tests",
    ...overrides,
  });
  if (response.status !== 201) {
    throw new Error(
      `Test workspace creation failed (${response.status}): ${JSON.stringify(response.body)}`,
    );
  }
  return response.body.data.workspace;
}

export async function addWorkspaceMember(
  ownerAgent,
  workspaceId,
  member,
  role = "employee",
) {
  return ownerAgent
    .post(`/api/workspaces/${workspaceId}/members`)
    .send({ email: member.email, role });
}

export async function createProject(agent, workspaceId, overrides = {}) {
  const response = await agent
    .post(`/api/projects/${workspaceId}/projects`)
    .send({
      name: "Test Project",
      description: "Project created by automated tests",
      priority: "medium",
      ...overrides,
    });
  if (response.status !== 201) {
    throw new Error(
      `Test project creation failed (${response.status}): ${JSON.stringify(response.body)}`,
    );
  }
  return response.body.data.project;
}

export async function addProjectMember(
  agent,
  workspaceId,
  projectId,
  userId,
  role = "member",
) {
  return agent
    .post(`/api/projects/${workspaceId}/projects/${projectId}/members`)
    .send({ userId, role });
}

export async function createTask(
  agent,
  workspaceId,
  projectId,
  overrides = {},
) {
  const response = await agent
    .post(`/api/projects/${workspaceId}/projects/${projectId}/tasks`)
    .send({
      title: "Test Task",
      description: "Task created by automated tests",
      priority: "medium",
      ...overrides,
    });
  if (response.status !== 201) {
    throw new Error(
      `Test task creation failed (${response.status}): ${JSON.stringify(response.body)}`,
    );
  }
  return response.body.data;
}

export async function createProjectFixture() {
  const owner = await registerUser({ name: "Workspace Owner" });
  const employee = await registerUser({ name: "Project Employee" });
  const outsider = await registerUser({ name: "Outsider" });
  const workspace = await createWorkspace(owner.agent);

  const addMemberResponse = await addWorkspaceMember(
    owner.agent,
    workspace.id,
    employee.user,
  );
  if (addMemberResponse.status !== 201) {
    throw new Error(
      `Adding test employee failed (${addMemberResponse.status}): ${JSON.stringify(addMemberResponse.body)}`,
    );
  }

  const project = await createProject(owner.agent, workspace.id);
  const projectMemberResponse = await addProjectMember(
    owner.agent,
    workspace.id,
    project._id,
    employee.user.id,
  );
  if (projectMemberResponse.status !== 201) {
    throw new Error(
      `Adding test project member failed (${projectMemberResponse.status}): ${JSON.stringify(projectMemberResponse.body)}`,
    );
  }

  return { owner, employee, outsider, workspace, project };
}
