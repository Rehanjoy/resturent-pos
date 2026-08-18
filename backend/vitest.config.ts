import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    globals: true,
    setupFiles: ["./tests/setup.ts"],
    // Business-logic and RBAC suites share one mongodb-memory-server
    // instance per file but must not run concurrently across files (each
    // spins up its own in-memory mongod) — kept sequential for reliability
    // over speed given this MVP's test-suite size.
    fileParallelism: false,
    testTimeout: 30_000,
    hookTimeout: 30_000,
  },
});
