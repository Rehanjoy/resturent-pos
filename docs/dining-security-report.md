# Smart Dining (Chair QR Ordering) — Security Review

**Date:** 2026-09-14
**Scope:** The uncommitted "smart dining" work-in-progress — chair-level QR seating, guest ordering, item-level cancellation with policy-based charges, and the new `dining-billing.service.ts` money math. Backend files audited in full (controllers/routes/validators/services/models listed below); frontend `components/dining/*` and `lib/dining/*` audited read-only for client-side token handling and trust boundaries (no edits made — a separate agent owns the UI/UX pass on those files).
**Method:** Line-by-line code review against `references/security-checklist.md`, cross-referencing the frontend API client against the backend validators/services to catch contract mismatches, running the existing automated test suite, and manually re-deriving the multi-tenant/authorization/idempotency/cancellation-math guarantees claimed in the task brief rather than taking them on faith.

**Result: no High-severity findings.** One Low-severity issue was found and fixed (non-constant-time token comparison). One Medium and two Low/informational issues are documented below as recommendations — none block this feature from shipping, but the Medium item should be picked up in the frontend pass already in flight.

Files reviewed:
- `backend/src/controllers/dining.controller.ts`, `backend/src/routes/dining.routes.ts`, `backend/src/validators/dining.validators.ts`
- `backend/src/services/dining.service.ts`, `backend/src/services/dining-billing.service.ts` (new)
- `backend/src/services/customer.service.ts`, `invoice.service.ts`, `order.service.ts`, `payment.service.ts`, `service-request.service.ts` (dining-related code paths)
- `backend/src/models/customer-visit.model.ts`, `dining-floor.model.ts`, `kot.model.ts`, `order.model.ts`
- `backend/tests/dining.test.ts`
- `backend/src/app.ts`, `backend/src/middleware/rate-limit.ts`, `backend/src/middleware/validate.ts`, `backend/src/middleware/error-handler.ts` (supporting context)
- `frontend/components/dining/*.tsx`, `frontend/lib/dining/api.ts`, `frontend/lib/dining/types.ts` (read-only)

---

## 1. Attack surface map

**Public, unauthenticated (`/api/public/dining/*`), rate-limited, no login:**
- `GET /:qrToken/context` — menu, tables, policy (read)
- `POST /:qrToken/holds` — claim chairs, start a session (write)
- `GET /:qrToken/session` — poll own session/order state, requires `X-Dining-Token` (read)
- `POST /:qrToken/order` — submit/add items, requires token + `idempotencyKey` (write)
- `POST /:qrToken/cancel/quote` — preview cancellation charge, requires token (read)
- `POST /:qrToken/cancel` — cancel items, requires token (write)

**Staff, authenticated + role-gated (`/api/dining/*`):**
- `GET /` — floor/session list (`operations`: owner/manager/server/cashier)
- `POST /holds` — staff-created seating (`operations`)
- `POST /sessions/:id/order`, `/release`, `/available` (`operations`)
- `GET /tables/:id/qr` (`operations`)
- `PATCH /policy` (`owner`/`manager` only)
- `PATCH /menu/:id/preparation`, `PATCH /orders/:id/items/:itemId/eta` (`kitchen`: owner/manager/chef)

Money enters at order submission (`priceSnapshot` always taken server-side from `MenuItem.price`, never from the client) and at cancellation (server-recomputed charge, see §4). PII (guest name/phone) enters at `holds` and is stored in `Contact`/`CustomerVisit`. No file uploads or third-party payment webhooks in this feature — payment capture happens elsewhere (`payment.service.ts`) and only transitions the order to `closed`, which this feature correctly treats as terminal (see §3).

## 2. Baseline claims — verified

All claims from the task brief were re-derived from the actual current code, not assumed:

- **Session tokens**: `randomBytes(32).toString("hex")` (256-bit), stored/compared only as a SHA-256 hash (`dining.service.ts:24`, `137-141`). Confirmed no plaintext token is ever persisted.
- **Restaurant scoping**: `authenticateSession` looks up the token hash only inside that restaurant's own `DiningFloor.sessions` array (one document per `restaurantId`, unique-indexed) — never a global/unscoped search. `resolveQr` similarly derives `restaurantId` from the table's own document. Confirmed with a passing cross-tenant test (`dining.test.ts:215-217`: a token from restaurant A rejected with `DINING_SESSION_INVALID` when checked against restaurant B).
- **Rate limiting**: `diningReadRateLimiter` (6000/15min/IP) and `diningWriteRateLimiter` (300/15min/IP) are applied to every public dining route (`dining.routes.ts:11-16`). See §5 for an adequacy assessment.
- **Zod validation with `.strict()` and bounded lengths**: confirmed on the write-sensitive schemas — `holdBody`, `staffHoldBody`, `cancellationQuoteBody`, `cancelBody`, the nested `customer`/`cancellationItem` objects. Two schemas (`orderBody`, `policyBody`) omit `.strict()` — see Finding 3, not currently exploitable.

## 3. Findings

| # | Area | Severity | Status |
|---|---|---|---|
| 1 | Non-constant-time session token comparison | Low | **Fixed** |
| 2 | Cancellation idempotency key never sent by the frontend client | Medium | Recommendation (frontend fix, out of my edit scope) |
| 3 | `orderBody`/`policyBody`/`preparationBody`/`etaBody` validators omit `.strict()` | Low / informational | Recommendation |
| 4 | Every guest session authentication performs a floor-wide optimistic-concurrency **write**, including pure reads | Low / informational | Recommendation (pre-existing, not introduced by this change) |

### Finding 1 — Non-constant-time session token comparison (Low) — FIXED

**Where:** `backend/src/services/dining.service.ts`, `authenticateSession()` (line ~148 before the fix).

**What was wrong:** The guest session lookup compared token hashes with plain `===`:
```ts
const session = floor.sessions.find(s => s.tokenHash === hash(token));
```
JavaScript string `===` short-circuits on the first mismatched character, which is a classic timing side-channel. The codebase already uses `crypto.timingSafeEqual` for exactly this reason elsewhere (`middleware/verify-meta-signature.ts`, verifying the WhatsApp webhook HMAC) — this comparison was the one place authenticating an anonymous bearer credential that didn't follow that pattern.

**Exploitability:** Low in practice — the token is a 256-bit random value, the attacker would need to win a byte-at-a-time timing race across a network (rate-limited to 300 write / 6000 read requests per 15 minutes per IP) against a comparison that also includes a full floor-document read/CAS-write round-trip, which adds enough jitter to make timing extraction very impractical. Still a real defense-in-depth gap worth closing given how cheap the fix is and that it's the sole authentication check for an anonymous, money-relevant session.

**Fix applied:**
```ts
function safeHashEquals(a: string, b: string) {
  const bufferA = Buffer.from(a, "hex");
  const bufferB = Buffer.from(b, "hex");
  return bufferA.length === bufferB.length && timingSafeEqual(bufferA, bufferB);
}
...
const tokenHash = hash(token);
const session = floor.sessions.find(s => safeHashEquals(s.tokenHash, tokenHash));
```
Re-verified: `npm run build`, `npm run typecheck`, and the full test suite (`npm test`, 216/216) all pass after the change; `tests/dining.test.ts` (12/12) passes unchanged.

### Finding 2 — Cancellation idempotency key accepted by the API but never sent by the frontend (Medium)

**Where:** `backend/src/validators/dining.validators.ts:14-21` (`cancelBody.idempotencyKey` is `optional()`), `backend/src/services/dining.service.ts:426-436` (`cancelOrder` only performs the idempotency-key replay check `if (input.idempotencyKey)`), and `frontend/lib/dining/api.ts:13`:
```ts
cancelItems: (qrToken, sessionToken, reason, items) =>
  api.post<DiningSessionResponse>(`${path(qrToken)}/cancel`, { reason, items }, authorization(sessionToken)),
```
The frontend never generates or sends an `idempotencyKey` for cancellation (contrast with `order()` on the line above it, which always sends `crypto.randomUUID()` via `orderKey.current` in `customer-dining.tsx`).

**Why it matters:** The task brief specifically asked me to verify idempotency is "actually enforced server-side... not just accepted and ignored" for order placement *and* cancellation. For order placement, it is fully enforced end-to-end. For cancellation, the server-side machinery exists and is correct (fingerprint-checked replay via `idempotencyKey`), but is dead code against the real frontend today, because the key it's supposed to check is never present.

**Is it actually unsafe?** No double-charge/double-cancel risk: a genuine race (double-tap, or a client retry after a timeout) is still caught by the lower-level MongoDB optimistic-concurrency guard in `cancelOrder` — the `$and: concurrencyPredicates` clause requires `cancelledQty` to still match what was read when the quote was computed, so a second write attempt against already-cancelled quantities fails the query and returns `updated === null`. Financially this is safe. The gap is a **robustness/UX** one: without the idempotency key, that failed second attempt falls straight to `throw new AppError("This order can no longer be cancelled...", 409, "ORDER_NOT_CANCELLABLE")` instead of recognizing the retry and returning the already-recorded result — so a guest whose cancellation actually succeeded server-side but whose response was lost to a network blip sees a scary "can no longer be cancelled" error rather than their successful cancellation.

**Recommendation (not fixed by me — this is a frontend file under active work by another agent per the task's read-only instruction):** Have `diningApi.cancelItems` generate and send an `idempotencyKey` (`crypto.randomUUID()`) exactly the way `diningApi.order` already does, keyed per cancellation attempt and reused on retry. No backend change is required — `cancelOrder` already handles the key correctly once it's present, per `dining.test.ts:157` (`await dining.cancelOrder(...); await dining.cancelOrder(...)` with the same `idempotencyKey` is already covered and passes).

### Finding 3 — Four dining validators don't call `.strict()` (Low / informational)

**Where:** `backend/src/validators/dining.validators.ts:10` (`orderBody`), `:22` (`policyBody`), `:23` (`preparationBody`), `:24` (`etaBody`) — unlike `holdBody`, `staffHoldBody`, `cancellationQuoteBody`, `cancelBody`, and the nested `customer`/`cancellationItem` schemas, which all call `.strict()`.

**Impact today: none.** `middleware/validate.ts` always replaces `req[source]` with Zod's *parsed* output (`(req as any)[source] = result.data`), and Zod's default object mode is `"strip"` — unrecognized keys are silently dropped from the parsed result regardless of `.strict()`. So a guest sending extra fields on `POST /order` (e.g. an attempted `priceOverride`) never reaches the controller either way; `.strict()` only changes whether the *whole request* is rejected with 400 versus the extra field being quietly ignored.

**Recommendation:** Add `.strict()` to these four schemas for consistency with the rest of the file and as defense-in-depth against a future refactor (e.g. if `validate.ts` ever stops replacing `req.body`, or a schema elsewhere gains `.passthrough()`). Left as a recommendation rather than a fix: this is a behavior change (silent-drop → 400-reject) on working, tested endpoints, and isn't something I judged safe to change unilaterally without confirming no legitimate caller currently relies on extra fields being ignored.

### Finding 4 — Guest session authentication performs a write on every read (Low / informational, pre-existing)

**Where:** `backend/src/services/dining.service.ts`, `authenticateSession()`, which calls `changeFloor(restaurantId, f => f)`. `changeFloor` always performs a compare-and-swap `DiningFloor.updateOne({ restaurantId, revision }, { $set: ..., $inc: { revision: 1 } })` after invoking its callback — even when the callback is a no-op identity function used purely to authenticate a token and re-derive the (possibly just-expired) session state.

**Impact:** Every `GET /session` poll (the frontend polls every 5s per open guest device while a session is active — `customer-dining.tsx:75-88`), every `cancel/quote`, and the auth step inside `order`/`cancel` all funnel through a single-document optimistic-concurrency write for that restaurant, bounded to 20 retries before surfacing `409 SEATING_BUSY` to the caller. At high concurrent guest counts (a busy multi-table restaurant with many devices polling simultaneously) this raises the chance of spurious contention/latency on what are semantically read operations. I confirmed via `git diff` that this exact line is unchanged by the current work-in-progress — it predates this PR and was implicitly accepted in the project's prior 2026-09-10 dining security addendum (`docs/05-security-report.md`) — but it's re-flagged here because the new cancellation-quote endpoint adds another `authenticateSession` call to the same hot path.

**Recommendation:** Give `authenticateSession` (and any other pure-lookup caller) a plain non-mutating `readFloor(restaurantId)` path, reserving `changeFloor`'s CAS write for calls that actually mutate `floor.sessions`/`policy`/`tableBlocks`. This is an architecture-level change spanning a hot path used by every dining endpoint, so I'm documenting it rather than changing it myself.

## 4. Deep-dive verification of the five specific risk areas called out in the task

**1. `dining-billing.service.ts` money math.** Pure integer-paise arithmetic throughout; the only floating-point-shaped operation is `Math.round((amount * ratePercent) / 100)`, applied once per tax line to already-integer paise inputs, matching the codebase's stated no-float discipline. No client-supplied value influences a price at any point — `priceSnapshot` always comes from `MenuItem.price` read from the database at order-submission time (`dining.service.ts:244-246`, `311-318`), and cancellation amounts are computed from that stored `priceSnapshot`, never from anything in the cancel request body.

**2. Idempotency on order placement/cancellation.** Order placement: fully enforced — deterministic, hash-derived item/KOT IDs (`deterministicId`, keyed by `restaurantId:sessionId:idempotencyKey:...`) mean a retried submit can never create a second Order/Kot; verified both by code and by the existing passing test `"creates one real order and KOT on retried submit..."`. Cancellation: enforced server-side when a key is supplied, and double-application is independently prevented at the DB level via the `cancelledQty` optimistic-concurrency predicate even without one — but see Finding 2, the frontend doesn't currently supply the key.

**3. Guest/staff authorization boundaries.** `staffId` is only ever sourced from `req.user!.userId` (the verified JWT claim) on staff-authenticated routes (`dining.controller.ts:18-20`); the public `hold` controller calls `dining.holdSeats(restaurantId, req.body)` with no third argument, so `staffId` is always `undefined` on the guest path, which also forces `customer` to be required and blocks the guest path from ever setting `status: "occupied"` directly (`holdSeats`, `dining.service.ts:109-136`). `holdBody`'s `.strict()` schema additionally rejects any guest attempt to smuggle a `staffId` field into the request body outright. Restaurant scoping is airtight everywhere a guest token touches data: every query chain (`Table`, `MenuItem`, `Order`, `Kot`, `DiningFloor`) is filtered by the `restaurantId` derived server-side from the QR token or session lookup, never from the request body — confirmed by code review and the passing cross-tenant test.

**4. Cancellation/refund math — quote vs. actual.** `cancelOrder` (`dining.service.ts:438-442`) always recomputes `chargePercent` fresh from the live policy and current server clock via `cancellationSelectionQuote`, and rejects the request (`CANCELLATION_QUOTE_CHANGED`, 409) unless the client's `acceptedChargePercent` exactly matches what the server just recomputed. The client cannot manipulate the charge it pays — it can only reject a stale quote and re-request a fresh one. Confirmed by code and by a dedicated passing test that deliberately submits a stale `acceptedChargePercent: 0` after the free-cancellation window has passed and asserts the `CANCELLATION_QUOTE_CHANGED` rejection, then succeeds only with the correct value (`dining.test.ts:101-103`).

**5. Rate limiting adequacy.** `diningWriteRateLimiter` (300/15min/IP) and `diningReadRateLimiter` (6000/15min/IP) are deliberately sized for many independent guests behind one restaurant's shared Wi-Fi/NAT IP (documented rationale in `rate-limit.ts:66-70`) while still capping abuse; this is a reasonable trade-off for a public, unauthenticated, money-relevant surface, and separating read/write limits means a busy dinner rush's legitimate polling traffic doesn't starve the stricter write limit. No change recommended here beyond Finding 4's note that the read path itself is heavier than it needs to be.

**6. `customer-visit.model.ts` / PII exposure.** Confirmed the public `GET /context` response excludes `DiningFloor.sessions` entirely (only aggregated per-chair `status` strings are returned via `listSeating`'s `tables` mapping) — a random QR scan never reveals any other guest's name/phone. `sessionDto` (`dining.service.ts:60-63`) strips `tokenHash`, `submission`, and `staffId` from every response and only includes `customer` for the session's own owner. Phone numbers are normalized and regex-validated (`normalizeCustomerPhone`) before any use in a Mongo filter, and the one place user input reaches a `$regex` filter (`customer.service.ts:51`, staff customer search) properly escapes regex metacharacters first — no NoSQL-injection vector via name/phone in either path.

## 5. Verification

```
cd backend && npm run build       # clean
cd backend && npm run typecheck   # clean
cd backend && npm test            # 216/216 passed (14 test files), including tests/dining.test.ts 12/12
cd backend && npm audit           # 0 vulnerabilities
```
No hardcoded secrets, API keys, or connection strings found in any audited dining file (`grep` sweep for `process.env`/`secret`/`SECRET`/`apikey` across the controller/routes/validators/services — zero matches other than the expected `env.corsOrigins` reference). No `dangerouslySetInnerHTML` and no `console.log`/`console.error` of the session token anywhere in the read-only-audited frontend dining components; the token is only ever sent as the `X-Dining-Token` request header (never a URL query param) and persisted to `localStorage` (a reasonable, already-flagged-in-code trade-off given the feature has no login — recommend the frontend UI pass note this as an accepted XSS-dependent exposure, not something to silently harden without a product conversation about session-restore UX).
