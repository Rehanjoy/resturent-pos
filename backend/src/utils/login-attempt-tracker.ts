/**
 * In-memory brute-force lockout tracker for login/PIN/2FA attempts
 * (mirrors the lockout copy in `docs/03-wireframes/login.html`: 5 failed
 * attempts locks the key out for 60 seconds). This is per-Node-process
 * state, which is fine for a single-instance self-hosted deployment. The
 * PRD calls for Redis-backed rate limiting (§5.3/§7) — Redis isn't wired
 * into this scaffold yet, so this stays in-memory for now. Move this to a
 * Redis-backed counter (alongside the rate limiter, see
 * `middleware/rate-limit.ts`) the moment the API runs as more than one
 * process, since in-memory state doesn't share across instances.
 */
interface AttemptRecord {
  failureCount: number;
  lockedUntil: number | null;
}

const MAX_ATTEMPTS = 5;
const LOCKOUT_DURATION_MS = 60_000;

const attempts = new Map<string, AttemptRecord>();

export function isLockedOut(key: string): boolean {
  const record = attempts.get(key);
  if (!record?.lockedUntil) return false;
  if (Date.now() >= record.lockedUntil) {
    attempts.delete(key);
    return false;
  }
  return true;
}

export function recordFailedAttempt(key: string): void {
  const record = attempts.get(key) ?? { failureCount: 0, lockedUntil: null };
  record.failureCount += 1;
  if (record.failureCount >= MAX_ATTEMPTS) {
    record.lockedUntil = Date.now() + LOCKOUT_DURATION_MS;
  }
  attempts.set(key, record);
}

export function resetAttempts(key: string): void {
  attempts.delete(key);
}

export function getLockoutSecondsRemaining(key: string): number {
  const record = attempts.get(key);
  if (!record?.lockedUntil) return 0;
  return Math.max(0, Math.ceil((record.lockedUntil - Date.now()) / 1000));
}
