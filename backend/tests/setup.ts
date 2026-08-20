/**
 * Runs before every test file's own imports resolve (Vitest `setupFiles`),
 * so `config/env.ts`'s fail-fast `requireEnv("JWT_ACCESS_SECRET")` etc.
 * never throws in the test process. These are throwaway test-only values,
 * never used outside this suite.
 */
process.env.JWT_ACCESS_SECRET ??= "test-access-secret-do-not-use-in-prod";
process.env.JWT_REFRESH_SECRET ??= "test-refresh-secret-do-not-use-in-prod";
process.env.CORS_ORIGIN ??= "http://localhost:3000";
// 64 hex characters (32 bytes) — required shape for `config/env.ts`'s
// `requireHexKey("ENCRYPTION_KEY", 32)`. Throwaway test-only value.
process.env.ENCRYPTION_KEY ??= "8251dd00e700a9acf30b4656c7f7c09c548ca9ac7ae91322a71c050416004674";
// Marketing module Part 2 — WhatsApp webhook secrets. Throwaway test-only
// values, never used outside this suite.
process.env.WHATSAPP_WEBHOOK_VERIFY_TOKEN ??= "test-webhook-verify-token";
process.env.META_APP_SECRET ??= "test-meta-app-secret-do-not-use-in-prod";
process.env.NODE_ENV = "test";
