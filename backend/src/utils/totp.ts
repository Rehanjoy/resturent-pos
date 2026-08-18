import { generateSecret, generateURI, verify } from "otplib";

const ISSUER = "Saffron";
// Allow one 30s time-step of clock drift either side, matching the
// conventional "window: 1" tolerance from earlier otplib versions.
const EPOCH_TOLERANCE_SECONDS = 30;

/** Generates a new Base32-encoded TOTP secret for 2FA enrollment. */
export function generateTwoFactorSecret(): string {
  return generateSecret();
}

/** Builds the `otpauth://` URI an authenticator app scans as a QR code. */
export function buildTwoFactorUri(email: string, secret: string): string {
  return generateURI({ issuer: ISSUER, label: email, secret });
}

/** Verifies a 6-digit TOTP code against the account's stored secret. */
export async function verifyTwoFactorCode(
  code: string,
  secret: string,
): Promise<boolean> {
  const result = await verify({
    secret,
    token: code,
    epochTolerance: EPOCH_TOLERANCE_SECONDS,
  });
  return result.valid;
}
