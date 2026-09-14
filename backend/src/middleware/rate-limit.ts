import rateLimit from "express-rate-limit";

/**
 * Rate limiting for `/api/auth/*`. The PRD calls for Redis-backed rate
 * limiting (§5.3/§7); Redis isn't wired into this scaffold yet, so this
 * uses express-rate-limit's default in-memory store (per Node process).
 * When Redis is introduced (planned for the Inventory/Reservations build
 * parts), swap in the `rate-limit-redis` store here — call sites in
 * `routes/auth.routes.ts` don't need to change, only the `store` option.
 */
export const authRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 60,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    message: "Too many requests. Try again later.",
    code: "RATE_LIMITED",
  },
});

// Tighter limiter specifically on the credential-checking endpoints
// (login/pin-login/2fa-verify) — brute force protection in addition to
// the per-account lockout in `utils/login-attempt-tracker.ts`. All three
// endpoints share this one limiter instance/counter per IP: a shared POS
// terminal can generate a lot of legitimate PIN-login traffic across many
// staff during a shift change, so this is deliberately higher than a
// single-account lockout threshold — it exists to stop distributed
// brute-forcing across accounts from one IP, not to rate-limit normal use.
export const loginRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    message: "Too many login attempts. Try again later.",
    code: "RATE_LIMITED",
  },
});

/**
 * Rate limiting for `/api/public/*` — the customer-facing website (PRD
 * §3.13 / §7 "rate limiting on ... public endpoints"). Deliberately a
 * separate, more generous limiter than `authRateLimiter`: this route has
 * no login wall at all, so a single busy restaurant's real dinner-rush
 * traffic (many different customers loading the menu from one shared
 * Wi-Fi/NAT IP) needs more headroom than a login-attempt counter, while
 * still capping abuse/scraping. Same in-memory-store caveat as the other
 * limiters in this file — swap in a Redis store here when Redis is wired
 * up (PRD §5.3).
 */
export const publicRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 100,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    message: "Too many requests. Try again later.",
    code: "RATE_LIMITED",
  },
});

/** Dining screens poll live seat/order state. Restaurant Wi-Fi commonly
 * places every guest behind one public IP, so the generic 100-request limit
 * would block legitimate guests after a few minutes. Reads get NAT-aware
 * headroom; writes retain a much tighter cap and still require a valid QR or
 * dining-session token before they can change state. */
export const diningReadRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 6000,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    message: "Live updates are temporarily busy. Try again shortly.",
    code: "RATE_LIMITED",
  },
});

export const diningWriteRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 300,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    message: "Too many booking requests. Try again shortly.",
    code: "RATE_LIMITED",
  },
});
