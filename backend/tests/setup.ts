/**
 * Runs before every test file's own imports resolve (Vitest `setupFiles`),
 * so `config/env.ts`'s fail-fast `requireEnv("JWT_ACCESS_SECRET")` etc.
 * never throws in the test process. These are throwaway test-only values,
 * never used outside this suite.
 */
process.env.JWT_ACCESS_SECRET ??= "test-access-secret-do-not-use-in-prod";
process.env.JWT_REFRESH_SECRET ??= "test-refresh-secret-do-not-use-in-prod";
process.env.CORS_ORIGIN ??= "http://localhost:3000";
process.env.NODE_ENV = "test";
