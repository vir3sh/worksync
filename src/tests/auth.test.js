import { describe, it, expect } from "vitest";
import request from "supertest";
import app from "../app.js";
import { registerUser, uniqueEmail } from "./helpers.js";

describe("Authentication endpoints (/api/users)", () => {
  it("POST /register registers a user and sets auth cookies", async () => {
    const agent = request.agent(app);
    const response = await agent.post("/api/users/register").send({
      name: "Valid User",
      email: uniqueEmail(),
      password: "TestPassword123!",
    });
    expect(response.status).toBe(201);
    expect(response.body.success).toBe(true);
    expect(response.body.data.user.email).toContain("@example.test");
    expect(response.headers["set-cookie"].join(" ")).toContain("accessToken");
    expect(response.headers["set-cookie"].join(" ")).toContain("refreshToken");
  });

  it("POST /register rejects invalid input", async () => {
    const response = await request(app).post("/api/users/register").send({ name: "A", email: "not-an-email", password: "short" });
    expect(response.status).toBe(400);
    expect(response.body.success).toBe(false);
  });

  it("POST /register rejects duplicate email", async () => {
    const email = uniqueEmail();
    const agent = request.agent(app);
    const payload = { name: "Duplicate User", email, password: "TestPassword123!" };
    expect((await agent.post("/api/users/register").send(payload)).status).toBe(201);
    const duplicate = await request(app).post("/api/users/register").send(payload);
    expect(duplicate.status).toBe(409);
  });

  it("POST /login logs in with valid credentials", async () => {
    const { user, password } = await registerUser();
    const response = await request(app).post("/api/users/login").send({ email: user.email, password });
    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(response.headers["set-cookie"].join(" ")).toContain("accessToken");
  });

  it("POST /login rejects an incorrect password", async () => {
    const { user } = await registerUser();
    const response = await request(app).post("/api/users/login").send({ email: user.email, password: "WrongPassword123!" });
    expect(response.status).toBe(401);
  });

  it("GET /me rejects requests without login", async () => {
    const response = await request(app).get("/api/users/me");
    expect(response.status).toBe(401);
    expect(response.body.success).toBe(false);
  });

  it("GET /me returns the authenticated user's safe profile", async () => {
    const { agent, user } = await registerUser();
    const response = await agent.get("/api/users/me");
    expect(response.status).toBe(200);
    expect(response.body.data.user.email).toBe(user.email);
    expect(response.body.data.user.password).toBeUndefined();
  });

  it("POST /refresh rejects a missing refresh cookie", async () => {
    const response = await request(app).post("/api/users/refresh");
    expect(response.status).toBe(401);
  });

  it("POST /refresh rotates a valid refresh session", async () => {
    const { agent } = await registerUser();
    const response = await agent.post("/api/users/refresh");
    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(response.headers["set-cookie"].join(" ")).toContain("refreshToken");
  });

  it("POST /logout clears auth cookies", async () => {
    const { agent } = await registerUser();
    const logout = await agent.post("/api/users/logout");
    expect(logout.status).toBe(200);
    expect(logout.body.success).toBe(true);
  });
});
