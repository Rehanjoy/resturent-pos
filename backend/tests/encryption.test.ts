import { describe, it, expect } from "vitest";
import { encrypt, decrypt } from "../src/utils/encryption";

/**
 * AES-256-GCM secrets-at-rest utility (`utils/encryption.ts`) — protects
 * the Marketing module's Meta WhatsApp access token (Part 1) and, later, a
 * Gemini API key (Part 3). `tests/setup.ts` seeds a throwaway
 * `ENCRYPTION_KEY` before these tests run.
 */
describe("AES-256-GCM encryption utility", () => {
  it("round-trips: decrypt(encrypt(x)) returns the original plaintext", () => {
    const plaintext = "EAAGm0PX4ZC-test-meta-permanent-access-token-1234567890";
    const encrypted = encrypt(plaintext);
    expect(decrypt(encrypted)).toBe(plaintext);
  });

  it("never leaves the plaintext readable inside the ciphertext string", () => {
    const plaintext = "super-secret-whatsapp-access-token-value";
    const encrypted = encrypt(plaintext);
    expect(encrypted).not.toContain(plaintext);
  });

  it("uses a fresh random IV each call, so the same plaintext never encrypts to the same ciphertext twice", () => {
    const plaintext = "identical-input-both-times";
    expect(encrypt(plaintext)).not.toBe(encrypt(plaintext));
  });

  it("throws rather than returning wrong bytes when the payload is tampered with", () => {
    const encrypted = encrypt("original-value");
    const tamperedCiphertext = `${encrypted.slice(0, -2)}00`;
    expect(() => decrypt(tamperedCiphertext)).toThrow();
  });

  it("throws on a malformed payload (wrong shape entirely)", () => {
    expect(() => decrypt("not-a-valid-payload")).toThrow();
  });
});
