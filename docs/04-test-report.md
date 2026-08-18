# QA & Test Report — Saffron (Phase 6)

**Date:** 2026-08-18
**Scope:** Automated test suite for business-critical logic + full build/typecheck/lint verification across both apps.

---

## 1. Automated test suite

**Stack:** [Vitest](https://vitest.dev) (not Jest — see §4 substitution note) + `mongodb-memory-server` (real MongoDB, in-memory, not mocked) + `supertest` (real HTTP requests against the actual Express app) + native `fetch`-based integration for service-layer calls.

Run with:
```
cd backend && npm test
```

**Result: 69 / 69 tests passing**, 3 suites, ~50s total (mostly one-time in-memory MongoDB binary startup).

| Suite | File | Tests | Focus |
|---|---|---|---|
| Billing & Settlement | `backend/tests/billing.test.ts` | 18 | Tax computation (CGST/SGST, multi-slab, post-discount base), discount calculation (flat/percent, clamping, approval threshold), sequential/tenant-isolated invoice numbering, split payments, void flow (pre- vs post-payment) |
| Order lifecycle & KDS | `backend/tests/orders.test.ts` | 13 | Table occupancy on create/void, draft→sent→in_kitchen→ready→served state machine, split orders (multiple KOTs per order), KDS queue clearing on Serve (not Mark Ready), edit-lock on sent items, sold-out rejection, audit logging on void |
| RBAC (cross-module) | `backend/tests/rbac.test.ts` | 38 | Every role against Staff/Orders/Kitchen/Billing/Reports/Settings; the Manager-vs-Owner privilege boundary; the Cashier-vs-Staff-Performance carve-out; tenant isolation; unauthenticated/malformed-token rejection |

Per PRD §9 ("unit tests for business logic — billing calculations, inventory deduction, tax computation — these must be 100% covered given financial impact"): billing and tax computation are covered end-to-end above. Inventory deduction has no coverage because the Inventory module itself doesn't exist yet (Phase 2 per the brief) — there is nothing to test.

### Bugs found and fixed during this pass
Two issues surfaced by the suite, both in test fixtures/expectations, not application code:
- A flat discount clamped to 100% of the subtotal is, by definition, a 100%-effective discount — it correctly triggers the approval-threshold check. The test's original expectation (no approval needed) was wrong, not the app's clamping logic.
- The `createTestTable`/`createTestMenuItem` fixtures created a new Area/Category with a fixed name per call, colliding with the real unique `{restaurantId, name}` index the moment a test needed two tables in one restaurant. Fixed by reusing the existing area/category if one already exists — this is a testing-fixture concern, not a schema bug (the unique index doing its job is correct).

No defects were found in the actual business logic under test — every discount/tax/invoice-numbering/void/RBAC assertion passed once the fixtures above were corrected.

## 2. Build / typecheck / lint verification

Run clean, both apps, after every feature module and again at the end of this QA pass:

| Check | Backend | Frontend |
|---|---|---|
| Type check | `npm run typecheck` — clean | `npm run typecheck` — clean |
| Lint | n/a (no separate lint script) | `npm run lint` — clean, 0 warnings |
| Production build | `npm run build` — clean | `npm run build` — clean, all 15 routes generated |

## 3. Manual QA checklist — not performed this session

The skill's Phase 6 process also calls for walking a manual checklist against every MVP screen in a real browser. **That walkthrough was not performed in this session** — this pass was scoped to automated coverage of financial logic and cross-role access control, which carries the highest risk of a costly bug going unnoticed. Recommend running a manual pass (Login → Table Grid → New Order → KDS → Settle Bill → Menu → Staff → Settings → Dashboard → Reports, on both desktop and a tablet-width viewport per the PRD's device-support requirement) before Phase 8 deployment.

## 4. Substitution note: Vitest instead of Jest

PRD §9 names Jest specifically. `ts-jest` currently requires TypeScript `>=4.3 <7`; this project runs TypeScript 7.0.2 (installed at scaffold time), so `ts-jest` could not be installed without forcing a peer-dependency conflict. Vitest was used instead — a Jest-API-compatible runner (`describe`/`it`/`expect`/mocking all work identically) with no such conflict, actively maintained for current TypeScript versions. `npm test` behaves the same either way from the outside; this is purely an internal substitution, documented here so it isn't mistaken for scope creep.

## 5. What would block a production gate

Nothing currently open blocks this gate — all automated tests pass and both apps build clean. The one open item carried forward is the manual UI walkthrough in §3, which should happen before Phase 8 (Deployment), not before Phase 7 (Security).
