import bcrypt from "bcryptjs";

// Coding standard requires bcrypt cost >= 10.
const SALT_ROUNDS = 10;

export async function hashPassword(plainTextPassword: string): Promise<string> {
  return bcrypt.hash(plainTextPassword, SALT_ROUNDS);
}

export async function comparePassword(
  plainTextPassword: string,
  passwordHash: string,
): Promise<boolean> {
  return bcrypt.compare(plainTextPassword, passwordHash);
}

export async function hashPin(plainTextPin: string): Promise<string> {
  return bcrypt.hash(plainTextPin, SALT_ROUNDS);
}

export async function comparePin(
  plainTextPin: string,
  pinHash: string,
): Promise<boolean> {
  return bcrypt.compare(plainTextPin, pinHash);
}
