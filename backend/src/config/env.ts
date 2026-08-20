import dotenv from "dotenv";

dotenv.config();

interface EnvConfig {
  nodeEnv: string;
  port: number;
  mongodbUri: string;
  corsOrigins: string[];
  jwtAccessSecret: string;
  jwtRefreshSecret: string;
  jwtAccessExpiry: string;
  jwtRefreshExpiry: string;
  encryptionKey: string;
  whatsappWebhookVerifyToken: string;
  metaAppSecret: string;
}

function requireEnv(name: string, fallback?: string): string {
  const value = process.env[name] ?? fallback;
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

/** Same fail-fast posture as `requireEnv`, plus a shape check — a key of
 * the wrong length would silently produce broken ciphertext instead of a
 * clear startup error, so it's caught here once instead of at first use. */
function requireHexKey(name: string, byteLength: number): string {
  const value = requireEnv(name);
  if (!/^[0-9a-fA-F]+$/.test(value) || value.length !== byteLength * 2) {
    throw new Error(
      `${name} must be a ${byteLength * 2}-character hex string (${byteLength} bytes). ` +
        `Generate one with: node -e "console.log(require('crypto').randomBytes(${byteLength}).toString('hex'))"`,
    );
  }
  return value;
}

export const env: EnvConfig = {
  nodeEnv: process.env.NODE_ENV ?? "development",
  port: Number(process.env.PORT ?? 5000),
  mongodbUri: requireEnv("MONGODB_URI", "mongodb://127.0.0.1:27017/saffron"),
  corsOrigins: requireEnv("CORS_ORIGIN", "http://localhost:3000")
    .split(",")
    .map((o) => o.trim()),
  // JWT signing secrets are real secrets — no fallback value. The process
  // must fail to start rather than sign tokens with a guessable default.
  jwtAccessSecret: requireEnv("JWT_ACCESS_SECRET"),
  jwtRefreshSecret: requireEnv("JWT_REFRESH_SECRET"),
  jwtAccessExpiry: process.env.JWT_ACCESS_EXPIRY ?? "15m",
  jwtRefreshExpiry: process.env.JWT_REFRESH_EXPIRY ?? "7d",
  // Marketing module secrets-at-rest (Meta WhatsApp access token now, a
  // Gemini API key in Part 3) — real secret, no fallback, same reasoning as
  // the JWT secrets above. See `utils/encryption.ts`.
  encryptionKey: requireHexKey("ENCRYPTION_KEY", 32),
  // Marketing module Part 2 — WhatsApp webhook (`whatsapp-webhook.routes.ts`).
  // A value *we* choose and paste into Meta's webhook config, not one Meta
  // hands us — still required with no fallback, same fail-fast posture,
  // because a guessable default would let anyone complete Meta's
  // verification handshake against our webhook URL.
  whatsappWebhookVerifyToken: requireEnv("WHATSAPP_WEBHOOK_VERIFY_TOKEN"),
  // Meta App secret, used only to verify the `X-Hub-Signature-256` HMAC on
  // inbound webhook POSTs (`middleware/verify-meta-signature.ts`) — the
  // real security boundary on that public, unauthenticated route. Real
  // secret, no fallback.
  metaAppSecret: requireEnv("META_APP_SECRET"),
};
