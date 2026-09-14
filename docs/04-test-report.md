# QA & Test Report — Saffron (Phase 6)

## 2026-09-14 dashboard analytics addendum

- Added exactly three responsive dashboard tabs: **Earnings**, **Staff**, and **Inventory**.
- Earnings uses settled billing data for revenue, tax, discounts, payment mix, seven-day trend and top sellers.
- Staff uses the existing seven-day staff-performance report; Inventory derives stock value, health, coverage and reorder risk from live inventory records.
- Owner/Manager workspace selections gate the sensitive tabs. Cashier accounts see clear restricted states and do not call forbidden Staff or Inventory endpoints; tab queries disable automatic retries.
- Dashboard ESLint, the full frontend TypeScript check, and the Next.js production build passed after implementation. The complete backend regression remains **219/219 passed** across **14 test files**.

## 2026-09-14 Chef access and staff workspace controls addendum

- Complete backend regression: **219/219 passed** across **14 test files**.
- Focused RBAC integration: **41/41 passed**, including Chef read access to table names required by
  Orders/KDS, role-safe workspace selection, and rejection of workspaces outside a role's allowed scope.
- Chef table access is read-only; table creation, edits, deletion and status actions keep their existing
  narrower role guards.
- Frontend navigation uses the workspaces selected in Staff Management, while the backend role matrix
  remains the authority for every action.
- The auth provider and live clock now have deterministic first renders, removing production React
  hydration error #418. React Query no longer retries 401/403 failures, preventing repeated forbidden
  requests from flooding the browser and backend.
- Frontend ESLint, frontend/backend TypeScript and both production builds pass. Next.js generated all
  **21 routes**.

## 2026-09-14 unified dining lifecycle addendum

- Complete backend regression: **216/216 passed** across **14 test files**.
- Dining coverage verifies repeat guest order batches, idempotent retries, selected item/quantity
  cancellation, per-line cancellation clocks and charges, transparent tax totals, whole-table booking,
  automatic waiter context, payment-to-cleaning transition and staff release after cleaning.
- Frontend ESLint and no-write TypeScript checks pass. Backend TypeScript passes. Backend and frontend
  production builds pass; Next.js generated all **21 routes**.
- Staff Orders and KDS now retain cancelled lines, show active and cancelled quantities, and expose the
  cancellation base, configured tax lines and payable amount without changing the original order audit.

## 2026-09-14 food-cost engineering addendum

- Focused costing suite: **7/7 passed** using the real Express routes and in-memory MongoDB.
- Exact money tests cover three fractional ingredient costs summed before rounding and a one-gram recipe
  contribution. Wastage, ingredient-based overhead, monthly overhead, per-dish extras, break-even and the
  price required to satisfy both configured targets are tested.
- Behaviour tests distinguish estimated loss, below-target margin, healthy and incomplete recipes; verify
  preferred seasonal months; and prove scenario comparison does not mutate live ingredient rates.
- Security tests cover authentication, Owner/Manager configuration permissions, invalid settings, tenant
  isolation, linked-unit protection and rate-change history.
- Sales-volume tests include only served, billed and closed non-cancelled orders and require the response
  to identify the result as a current-cost estimate rather than historical net profit.
- Complete backend regression at the time of the costing pass: **212/212 passed** across **14 test files**. The focused costing suite is
  included in that result.
- Frontend ESLint and no-write TypeScript checks pass. Backend TypeScript and both production builds pass;
  Next.js generated all **21 routes**.

## 2026-09-13 customer, service and production addendum

- Complete backend regression run: **205/205 passed** across 13 test files.
- New integration coverage verifies required guest identity and Indian mobile normalisation, duplicate
  service-request prevention, chair ownership, the staff acknowledge/complete flow, and customer search.
- Recipe tests verify that a 10-portion batch using 2 kg rice and 0.5 L oil scales to exactly 5 kg and
  1.25 L for 25 portions, including ingredient cost and shortage calculation.
- Closed-day measured-use reconciliation is tested as an exactly-once operation: a repeated request does
  not change stock or add a duplicate ledger entry.
- Backend typecheck and production build pass. Frontend ESLint, no-write TypeScript check and production
  build pass; Next.js generated all **21 routes**, including Customers and the guest ordering route.

## 2026-09-10 dining and inventory addendum

- Business-critical integration run: **58/58 passed** across dining, ordering, billing, inventory and
  inventory reporting. It covers concurrent multi-table chair claims, hold expiry, staff sessions,
  exact 8/10-minute cancellation boundaries, partial-charge invoices, counter settlement, KDS ETA,
  whole-table conflicts, tenant isolation, validation, daily inventory reporting and retry-safe stock.
- Complete regression run: **203/203 passed** across all 12 backend test files. After the final
  public-rate-limit adjustment, the focused dining and inventory-reporting rerun passed **15/15**.
- Frontend TypeScript and ESLint passed. Backend TypeScript and production build passed. The frontend
  production build passed and generated all 20 routes.
- Manual mobile smoke test at 390 × 844: scanned a chair QR; selected six chairs across two tables;
  confirmed the five-minute countdown; opened the photo menu; customized an item; reviewed the
  ₹0 / 50% / 100% cancellation timeline and counter-payment message; placed the order.
- The responsive desktop/tablet layouts were checked through the browser accessibility tree. The tested
  customer flow had no overlapping controls, missing labels, or console errors after the public-route
  provider fix.

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

Per PRD §9 ("unit tests for business logic — billing calculations, inventory deduction, tax computation — these must be 100% covered given financial impact"): billing and tax computation are covered end-to-end above. Inventory and QR deduction coverage was added in the 2026-09-10 addendum.

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

## 3. Manual QA checklist — latest automated pass only

The skill's Phase 6 process also calls for walking a manual checklist against every MVP screen in a real browser. **That walkthrough was not performed in this session** — this pass was scoped to automated coverage of financial logic and cross-role access control, which carries the highest risk of a costly bug going unnoticed. Recommend running a manual pass (Login → Table Grid → New Order → KDS → Settle Bill → Menu → Staff → Settings → Dashboard → Reports, on both desktop and a tablet-width viewport per the PRD's device-support requirement) before Phase 8 deployment.

## 4. Substitution note: Vitest instead of Jest

PRD §9 names Jest specifically. `ts-jest` currently requires TypeScript `>=4.3 <7`; this project runs TypeScript 7.0.2 (installed at scaffold time), so `ts-jest` could not be installed without forcing a peer-dependency conflict. Vitest was used instead — a Jest-API-compatible runner (`describe`/`it`/`expect`/mocking all work identically) with no such conflict, actively maintained for current TypeScript versions. `npm test` behaves the same either way from the outside; this is purely an internal substitution, documented here so it isn't mistaken for scope creep.

## 5. What would block a production gate

Nothing currently open blocks this gate — all automated tests pass and both apps build clean. The one open item carried forward is the manual UI walkthrough in §3, which should happen before Phase 8 (Deployment), not before Phase 7 (Security).
