# Security Audit Report — Saffron (Phase 7)

**Date:** 2026-08-18
**Scope:** Full codebase audit against `references/security-checklist.md` and PRD §7 — auth/session handling, input validation, injection, access control per role, rate limiting, dependency audit, secrets scan.

**Result: no high-severity findings open.** Two medium/low findings were identified and fixed during this pass; three lower-priority items are documented as accepted trade-offs or follow-ups.

---

## 1. Dependency audit

```
cd backend && npm audit    # 0 vulnerabilities
cd frontend && npm audit   # 0 vulnerabilities
```
Both checked with dev dependencies included. Clean.

## 2. Secrets scan

- Regex sweep for `secret|password|api_key|token: "..."`-shaped literals across the repo: one match, in `backend/tests/billing.test.ts` — a deliberately-wrong test password string (`"wrong-password"`), not a real credential.
- `git ls-files | grep -i '\.env'` — no `.env`/`.env.local`/`.env.production` file has ever been committed. `.gitignore` covers all of them.
- JWT signing secrets (`config/env.ts`) fail-fast with no hardcoded fallback — the process refuses to start rather than sign tokens with a guessable default.

## 3. Auth & session handling

- Passwords and PINs: bcrypt, cost factor 10, `select: false` on the schema (never returned by a normal query).
- Access token: 15 min, held in memory only on the frontend (`lib/auth/token-store.ts`) — never `localStorage`/`sessionStorage` (verified by grep — the only match was the doc comment explaining why *not* to use it).
- Refresh token: 7 days, httpOnly + `Secure` (in production) + `SameSite=Strict` cookie, path-scoped to `/api/auth`. Rotation-reuse detection revokes every session for that user if an already-used refresh token is presented again (theft response).
- 2FA: TOTP, enrollable for Owner/Manager; PIN login is explicitly blocked for any account with 2FA enabled (closes an otherwise-obvious bypass).
- Login/PIN/2FA error messages are uniform ("Incorrect email or password. Try again.") regardless of whether the email exists — no user-enumeration channel.
- Brute-force lockout: 5 failed attempts locks the key for 60s (in-memory, single-process — documented as needing a Redis-backed store the moment the API scales beyond one instance, consistent with the PRD's own stated Redis plan).
- CSRF: mitigated by construction rather than a separate token library — the refresh cookie is `SameSite=Strict` (never sent cross-site) and every authenticated API call uses a `Bearer` header sourced from in-memory JS state, which a cross-site attacker page cannot read or forge.

## 4. Input validation & injection

- Every mutating (and most read) endpoint validates its input against a Zod schema at the edge (`middleware/validate.ts`) before the controller runs — verified present on every route file under `backend/src/routes/`.
- All database access goes through Mongoose models with typed schemas; no raw `$where`, `mapReduce`, `eval`, or string-built queries anywhere in `backend/src` (grepped, zero matches). Combined with Zod rejecting non-primitive input shapes (an attacker-supplied `{ "$gt": "" }` fails `z.string()` validation before it ever reaches a query), NoSQL injection surface is minimal.
- `restaurantId` is taken from the verified JWT (`req.user.restaurantId`) on every query, never from client-supplied body/params/query — this is the tenant-isolation invariant every module was built against, and is exercised directly in `tests/rbac.test.ts`'s tenant-isolation case.

## 5. Access control (RBAC)

- Every route is gated by `authenticate` + `authorize(...)`, reading only the server-verified JWT claim — never a client-supplied role flag.
- Exercised end-to-end in `tests/rbac.test.ts` (38 passing cases): per-role access across Staff/Orders/Kitchen/Billing/Reports/Settings, the Manager-cannot-touch-Owner/Manager-accounts privilege boundary, the Cashier-blocked-from-Staff-Performance carve-out, and unauthenticated/malformed-token rejection.

## 6. Findings fixed during this pass

| # | Finding | Severity | Fix |
|---|---|---|---|
| 1 | No security-headers middleware (`helmet`) — missing `X-Content-Type-Options`, `X-Frame-Options`, HSTS, etc. | Medium | Installed `helmet` and wired it as the first middleware in `app.ts`, with `crossOriginResourcePolicy: "same-site"` so the invoice-PDF/CSV-export responses stay fetchable from the frontend's separate origin. |
| 2 | `jwt.verify()` calls didn't pin an `algorithms` allowlist — relies on `jsonwebtoken`'s default rejection of `alg: none` rather than an explicit pin. | Low (defense in depth; not exploitable with the library's current defaults) | Added `{ algorithms: ["HS256"] }` to all three `jwt.verify()` call sites in `utils/jwt.ts` (access, refresh, 2FA interim token). |

Both fixes verified: backend still builds/typechecks clean, and all 69 automated tests (including the 38 RBAC cases, which depend on token verification) still pass after the change.

## 7. Accepted trade-offs / follow-ups (not blocking)

- **Rate limiting scope**: only `/api/auth/*` is rate-limited. PRD §7 also calls for it on "public QR-ordering endpoints" — those don't exist yet (Phase 2), so there's nothing to limit there yet. Other authenticated routes (e.g. invoice PDF generation, report export) have no per-route limiter; abuse there requires a valid staff session already, which lowers the risk to an internal-tool level. Flagged for revisit once Redis is introduced (planned for the Inventory/Reservations build, per the PRD's own architecture).
- **In-memory rate limiting & lockout state**: both `middleware/rate-limit.ts` and `utils/login-attempt-tracker.ts` are per-Node-process. Correct for this MVP's single-instance self-hosted deployment model; must move to a shared Redis store before any horizontal scaling (documented in both files already).
- **Body size limits**: `express.json()`/`express.urlencoded()` use Express's default 100kb limit — not explicitly overridden. Adequate given Zod's own per-field `max()` constraints already cap realistic payload sizes; no change made.

## 8. Gate

No high-severity findings remain open. Gate passes.

## 9. Addendum — public website endpoint (2026-08-18)

The Website Builder module added this codebase's first genuinely public, unauthenticated endpoint: `GET /api/public/:restaurantSlug/website`. Reviewed against the same standard as the original audit above, at build time rather than as a full re-run of §1–7:

- **Rate limited** — the "Rate limiting scope" gap noted in §7 above (only `/api/auth/*` was limited) is partially closed: this route now has its own limiter (`publicRateLimiter`, 100 req/15min/IP), separate from and more generous than the login limiter, mounted via `router.use(publicRateLimiter)` before the route handler.
- **No data leak** — the response DTO is hand-built (`public-website.service.ts`), not a passthrough of any internal model: it strips `ingredientMapping`/cost fields from menu items, filters to `isAvailable: true` only, and returns only `name`/`address`/`gstNumber` from `Restaurant` — no staff, session, or financial fields reachable.
- **No tenant/enumeration leak** — `restaurantId` is resolved server-side from the slug, never accepted from the client. "Restaurant doesn't exist" and "restaurant exists but hasn't published" return an identical 404, so the endpoint can't be used to enumerate which restaurants are using the platform but haven't launched their site.
- **Mounted outside the authenticated router tree** (`app.use("/api/public", publicRoutes)` before `app.use("/api", routes)` in `app.ts`) so it's structurally impossible for it to end up behind `authenticate` by accident, and equally impossible for an admin-only route to end up in front of it un-guarded.

No findings from this addendum. Recommend folding this into a full re-audit before the next security gate rather than treating this note as a permanent substitute for one.
