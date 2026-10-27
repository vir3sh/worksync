import mongoose from "mongoose";
import { MongoMemoryServer } from "mongodb-memory-server";
import { beforeAll, afterAll, afterEach, vi } from "vitest";

// Test-only secrets. Never reuse production secrets here.
process.env.NODE_ENV = "test";
process.env.ACCESS_TOKEN_SECRET = "WorkSync-test-access-secret-change-me";
process.env.REFRESH_TOKEN_SECRET = "WorkSync-test-refresh-secret-change-me";
process.env.ACCESS_TOKEN_EXPIRES_IN = "15m";
process.env.REFRESH_TOKEN_EXPIRES_IN = "7d";
process.env.SMTP_USER = "WorkSync-tests@example.com";

// Prevent tests from contacting Gmail SMTP.
vi.mock("../config/email.js", () => ({
  default: {
    sendMail: vi.fn().mockResolvedValue({ messageId: "test-message" }),
  },
}));

let mongoServer;

beforeAll(async () => {
  mongoServer = await MongoMemoryServer.create();
  await mongoose.connect(mongoServer.getUri());

  // Ensure model indexes (including unique indexes) exist before testing.
  await Promise.all(
    Object.values(mongoose.models).map((model) => model.init()),
  );
}, 60000);

afterEach(async () => {
  const collections = Object.values(mongoose.connection.collections);
  await Promise.all(collections.map((collection) => collection.deleteMany({})));
});

afterAll(async () => {
  await mongoose.disconnect();
  if (mongoServer) await mongoServer.stop();
}, 60000);
