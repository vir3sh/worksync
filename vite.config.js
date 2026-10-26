import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    setupFiles: ["./src/tests/setup.js"],
    testTimeout: 30000,
    hookTimeout: 60000,
    clearMocks: true,
    restoreMocks: true,
  },
});
