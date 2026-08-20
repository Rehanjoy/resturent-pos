import { createCipheriv, createDecipheriv, randomBytes } from "crypto";
import { env } from "../config/env";

/**
 * AES-256-GCM helpers for secrets-at-rest — distinct from
 * `utils/password.ts`'s one-way bcrypt hashing, because this module needs
 * to read the plaintext back (to call the Meta Graph API with the
 * restaurant's own WhatsApp access token; a Gemini API key in Part 3),
 * whereas a password/PIN is never read back, only compared.
 *
 * `ENCRYPTION_KEY` (see `.env.example` / `docs/env-registry.md`) is a
 * 32-byte key, hex-encoded (64 hex characters) — required with no
 * fallback, same fail-fast posture as the JWT secrets in `config/env.ts`.
 */
const ALGORITHM = "aes-256-gcm";
const KEY_LENGTH_BYTES = 32;
const IV_LENGTH_BYTES = 12; // 96-bit nonce — the size GCM is designed for.

function getKeyBuffer(): Buffer {
  const key = Buffer.from(env.encryptionKey, "hex");
  if (key.length !== KEY_LENGTH_BYTES) {
    // Should be unreachable — `config/env.ts` already validates this at
    // process startup — but a wrong-length key must never silently produce
    // garbage ciphertext, so this stays as a defensive second check.
    throw new Error(
      `ENCRYPTION_KEY must decode to ${KEY_LENGTH_BYTES} bytes (${KEY_LENGTH_BYTES * 2} hex characters).`,
    );
  }
  return key;
}

/**
 * Encrypts `plaintext`, returning a single self-contained string
 * (`"iv:authTag:ciphertext"`, each segment hex-encoded) that's safe to
 * store directly in a Mongo string field. A fresh random IV is generated
 * per call, so encrypting the same plaintext twice never produces the same
 * ciphertext — never reuse an IV with the same key for GCM.
 */
export function encrypt(plaintext: string): string {
  const key = getKeyBuffer();
  const iv = randomBytes(IV_LENGTH_BYTES);
  const cipher = createCipheriv(ALGORITHM, key, iv);
  const ciphertext = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const authTag = cipher.getAuthTag();
  return `${iv.toString("hex")}:${authTag.toString("hex")}:${ciphertext.toString("hex")}`;
}

/**
 * Reverses `encrypt`. Throws if `payload` is malformed or the auth tag
 * doesn't match (tampered ciphertext, or the wrong `ENCRYPTION_KEY`) —
 * GCM authenticates on decrypt, it never silently returns wrong bytes.
 */
export function decrypt(payload: string): string {
  const key = getKeyBuffer();
  const [ivHex, authTagHex, ciphertextHex] = payload.split(":");
  if (!ivHex || !authTagHex || !ciphertextHex) {
    throw new Error('Malformed encrypted payload — expected "iv:authTag:ciphertext".');
  }

  const decipher = createDecipheriv(ALGORITHM, key, Buffer.from(ivHex, "hex"));
  decipher.setAuthTag(Buffer.from(authTagHex, "hex"));
  const plaintext = Buffer.concat([
    decipher.update(Buffer.from(ciphertextHex, "hex")),
    decipher.final(),
  ]);
  return plaintext.toString("utf8");
}
