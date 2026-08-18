import { createHash } from "crypto";

/**
 * Refresh tokens are stored in the database as a SHA-256 hash, not the raw
 * value — a random 256-bit-signed JWT already has enough entropy that a
 * fast, unsalted hash is fine for exact-match lookup (unlike passwords/
 * PINs, which use bcrypt because they're low-entropy and user-chosen).
 */
export function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}
