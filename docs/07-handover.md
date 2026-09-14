# Saffron — Handover Document

**Client:** digitecweb · **Version:** 1.0 (MVP) · **Date:** 2026-08-18 · **Prepared by:** development team

**Status: MVP feature-complete, tested, and security-audited. Not yet deployed.** Sections 5, 7, 8, and 10 below are marked pending — they depend on hosting/domain/account decisions that only the client can make (Phase 8). This document will be updated once that happens.

---

## 1. What this application is

Saffron is a restaurant POS and management platform: order taking, a live kitchen display, table management, menu management, GST billing, staff management, a sales dashboard, and reports — covering a restaurant's full front-of-house operations lifecycle. It's built as two separate applications (a Next.js admin/POS frontend and a Node/Express API) that a restaurant runs together, either self-hosted on-premise or in the cloud. Staff log in with a role (Owner, Manager, Cashier, Server, Chef, or Inventory Manager) and only see the screens their role is permitted to use.

## 2. How the app works (per module)

### Auth
Email + password login (JWT access token, 15 min, held in browser memory only; refresh token, 7 days, httpOnly cookie). POS terminals can also use a fast PIN login for shift clock-in — blocked for any account with 2FA enabled, since 2FA is mandatory for Owner/Manager. Admin-created staff accounts are forced to reset their password on first login.

### Tables & Areas
Owner/Manager create Areas (e.g. "AC Indoor", "Terrace") and Tables within them. The Table Grid shows live status — free / occupied / reserved / needs cleaning — synced instantly across every open terminal over WebSocket. Server role can change a table's status (e.g. mark it free after cleaning) but can't add/delete tables themselves.

The unified floor workspace shows every numbered chair, table controls, QR codes, bookings and active
visits in one place. Owner/Manager can generate and download one QR per chair; floor staff can click the
table centre to seat a whole table or click individual chairs, including chairs across multiple tables.
Separate parties can share a physical table while keeping separate orders and bills. Customer QR holds
expire after the policy countdown (five minutes by default); staff bookings have no timer and must be
released after settlement and cleaning. A group with an unpaid order cannot be released. A whole-table
booking colours and pulses the full table in red; a chair booking colours only those occupied chairs.
After payment the seating changes to Cleaning, then staff tap **Cleaning done · Mark available**.

Both guest and staff seating flows capture a name and mobile number. The responsive floor uses a
physical table-and-chair layout rather than abstract table tiles. A water, bill or help request marks
the exact table/chair for staff, with motion disabled automatically when the device requests reduced
motion.

### Menu
Owner/Manager manage Categories and Dishes (price, veg/non-veg, spice level, image URL, description). The availability toggle is how a dish gets "86'd" (marked sold out) instantly — everyone else sees the menu read-only.

### Orders & Kitchen (KDS)
Tap a free table → New Order screen: pick a category, add dishes with customization (spice level, add-ons, notes) to a running cart, then **Send to Kitchen**. This creates a Kitchen Order Ticket (KOT) that appears live on the Kitchen Display board. A table's order can be sent to the kitchen in more than one batch — e.g. a dessert added after mains already went out becomes its own ticket, without disturbing the first one. The kitchen (Owner/Manager/Chef) marks items ready; tickets only leave the active board once a server **Serves** the ready items from the floor side, not the moment the kitchen finishes cooking — this is deliberate, matching how a real floor works.

Guests open `/order/<tableQrToken>~<chairNumber>`, enter party size, choose available seating, and get a
server-time countdown. Placing an order makes those seats occupied and sends one real order/KOT to the
kitchen. The system assigns an active waiter when available. Guests can return to the menu and submit
additional batches; each batch is retry-safe and appears as a separate KOT while inventory deducts once.
Guests see every item's ETA and status and pay at the counter. Settings controls the hold,
default preparation time, and cancellation windows. The default policy is free before 8 minutes, 50%
from 8 to under 10 minutes, and full charge from 10 minutes. Guests choose exact items and quantities to
cancel, and the charge window uses each line's kitchen-send time. The original lines remain in the audit,
while guest, staff Orders and KDS show cancelled quantities and the applicable free/half/full charge. A
charged cancellation becomes part of the non-discountable counter invoice.

The guest screen refreshes item status and ETA continuously and announces meaningful changes in-app.
Guests can request water, the bill or staff help; the staff floor queue acknowledges and completes each
request so the guest can see that it is being handled. The floor shows the assigned waiter and exact
table/chair context for every open request.

### Customers
The Customers screen combines returning visits by normalised mobile number. It shows visit count, time
spent, party size, order value and amount actually paid. Owner/Manager can maintain a Normal, Good guest,
VIP or Service attention label and private factual service notes. The label is never inferred from spend
alone, and creating a dining visit never grants marketing consent.

### Billing & Settlement
Once every item on an order is served, Owner/Manager/Cashier can generate the bill: it computes GST (CGST/SGST, or whatever tax slabs are configured in Settings) on the post-discount subtotal, supports flat or percentage discounts, and **requires a manager's password to approve any discount above the configured threshold** (default 15%) — this can't be bypassed from the UI, it's enforced by the server. Payment can be split across cash/card/UPI; the amounts must sum exactly to the bill total. Invoice numbers are sequential and never reused, even under concurrent settlements. A bill can be voided with a mandatory reason (Owner/Manager only, fully logged) — voiding an unpaid bill reopens the order for correction; voiding an already-paid bill does not undo the payment, it's a logged record only.

Guest bills expose the taxable item subtotal, every configured tax name/rate/amount, cancellation base,
cancellation tax and final amount due. Thus ₹260 with CGST 9% and SGST 9% is explicitly displayed as
₹260 + ₹23.40 + ₹23.40 = ₹306.80. The same cancellation history and payable charge are visible in staff
Orders, so the cashier and guest work from the same figures.

### Staff
Owner/Manager add, edit, and deactivate staff accounts. **A Manager can fully manage frontline roles (Cashier/Server/Chef/Inventory Manager) but can never create, edit, or deactivate an Owner or another Manager account** — this stops a Manager from ever escalating privileges. Every staff member has an activity log (their orders, voids, discounts) and a list of active login sessions that can be individually revoked.

The Add/Edit Staff form includes **Visible workspaces**. The selector only offers modules that the chosen
role is already allowed to use; it can hide navigation entries but cannot grant a Chef, Cashier or other
frontline role an Owner/Manager action. Legacy accounts automatically receive the standard defaults for
their role. Chef defaults are Orders, Kitchen, Menu and Inventory. Kitchen and Orders can read table names
for ticket labels, while table management remains restricted by its separate action guards.

### Settings
Restaurant profile, GST/tax configuration, discount approval threshold, and which payment modes are accepted. Owner-only for the restaurant's core identity (name, GST number, logo); Manager can adjust the operational settings (tax slabs, discount threshold, payment modes).

### Dashboard & Reports
Dashboard: today's sales (gross/net/tax/discounts), payment mode split, live table/kitchen counts, low-stock count, top dishes, and a 7-day trend. Reports: the same data filterable by date range (Today/Yesterday/Last 7 Days/This Month/Custom), plus revenue by category and by payment mode, top and slow-moving dishes, and staff performance (orders handled, average table turnaround) — **the Staff Performance report is hidden from Cashiers**, everything else is visible to Owner/Manager/Cashier. CSV export is available on the sales and top-dishes reports.

### Inventory
Owner/Manager/Inventory Manager manage stock items, categories, and suppliers; Chef has view-only access (visibility into what's being consumed, per the RBAC matrix). Each dish's ingredients can be mapped in the Menu module ("Ingredients used" on the add/edit dish form) to a quantity of a stock item. **Stock deducts automatically** when a staff order is sent to the kitchen or a guest confirms a QR order. If a deduction would take stock negative, it's allowed and logged rather than blocking the kitchen from getting the order — the low-stock/reorder signal surfaces the problem. Manual stock corrections (wastage, recount) go through a Stock Entry action that requires a reason and is audited. Items below their reorder threshold show a Reorder badge; marking one Reordered clears once a receipt brings stock above threshold.

Each item also stores expected daily usage and shows projected days remaining. The inventory table
separates today's received, used, wasted and corrected quantities using India Standard Time day
boundaries. Stock Entry requires the movement type, amount and reason, so receipts are never counted as
consumption. QR-order stock deduction is idempotent and can repair an interrupted ledger write without
deducting the stock twice.

The **Recipe & daily production planner** stores one standard batch recipe per dish: batch yield plus the
measured quantity of each ingredient. It displays batch and per-portion quantities, converting kg to g
and litres to ml for quick checking. A daily portion plan aggregates rice, oil and every other ingredient,
then shows required stock, available stock, shortage and planned cost. Saving a plan is an estimate and
does not deduct inventory; sending actual orders to the kitchen performs the recipe deduction. After a
day closes, staff can enter weighed used and wasted amounts. Reconciliation posts only the difference
from existing ledger movements and is safe to retry once.

The Inventory page now has three workspaces: **Ingredients**, **Recipes & production**, and **Dish
profitability**. Ingredients can be filtered by category and stock health, sorted by name, stock value or
base quantity, and inspected for linked dishes and purchase-rate history. Changing a purchase rate updates
all linked cost sheets; old invoices remain unchanged. A linked ingredient's base unit is locked until its
recipes are relinked, which prevents a kg-to-g label change from multiplying recipe consumption.

Dish profitability calculates current ingredient cost, wastage allowance, shared overhead and per-portion
packaging/labour/utilities/other costs. It shows total estimated cost, contribution, margin, food-cost %,
break-even and target price. Owner/Manager set restaurant targets and per-dish costs. Inventory Manager and
Chef can inspect cost sheets and run price/rate scenarios. A scenario does not change stock or rates; an
Owner/Manager can separately apply its selling price to the live menu. Seasonal months are entered by staff
and prompt a rate check outside the preferred season. Recent fulfilled volume uses today's recipe and rates,
so it is a planning estimate rather than historical accounting profit.

### Reservations
Owner/Manager/Cashier/Server, filtered by date with status pills (Confirmed/Waitlist/Seated/No-show/Cancelled). Assigning a table to a reservation puts a hold on it (`Table.status = reserved`) immediately — there's no background job watching the clock for a "reservation time ± buffer" window (this app has no job scheduler yet), so the hold is entirely driven by staff actions: assign → hold, seat → table becomes occupied (this does not create an order — the server still opens New Order from the Tables screen, same as any walk-in), cancel/no-show → hold releases back to free, but only if nothing else (an active order, another reservation) is using that table.

### Website Builder
Two halves. **Admin editor** (`/admin/website`): hero image/headline, about text, an image gallery, contact details, and a Publish toggle — Owner can edit, Manager can only view (this is a deliberate exception to this app's usual "Manager can edit operational settings" pattern; the PRD is explicit that Website is Owner-only for editing). **Public site** (`/[restaurant-slug]`, no login): a real, unauthenticated page built from a dedicated public API endpoint that only ever returns public-safe data — restaurant name/address, published content, and the live *available* menu (never ingredient/cost data, never 86'd items). An unpublished site and a nonexistent restaurant slug both 404 identically, so a guessed slug can't be used to find restaurants that haven't launched yet. This endpoint has its own, more generous rate limiter separate from the staff-login limiter, since real anonymous customers hit it. Includes SEO meta tags and Schema.org `Restaurant` structured data.

### Not yet built (Phase 2/3, per the product brief)
WhatsApp/SMS notifications (no provider integration exists yet), multi-station KDS routing, shift scheduling, advanced analytics/forecasting, delivery aggregator integrations, multi-branch support.

## 3. Architecture

```
Next.js (App Router, TypeScript)  ──REST + WebSocket──▶  Express API (TypeScript)
        "frontend/"                                            "backend/"
                                                                    │
                                                              MongoDB (Mongoose)
```

Frontend and backend are **two separate codebases** (not a single Next.js app with API routes) per the client's explicit instruction — they can be deployed independently. Real-time updates (new kitchen tickets, table status changes) go over Socket.io, scoped to a `restaurant:{id}` room so multiple restaurants on shared infrastructure never see each other's events.

**Repo structure:**
```
resturent-pos/
├── docs/              product brief, brand kit, this handover, env registry, test/security reports
├── assets/             logo files (SVG)
├── backend/
│   └── src/
│       ├── config/     env loading, DB connection
│       ├── models/     Mongoose schemas
│       ├── services/   business logic (one file per module)
│       ├── controllers/ req/res only, no logic
│       ├── routes/     endpoint definitions + RBAC (authorize()) + validation
│       ├── middleware/ auth, RBAC, rate limiting, validation, error handling
│       └── sockets/    Socket.io server + room management
│   └── tests/          automated test suite (Vitest)
└── frontend/
    └── app/admin/       every POS/dashboard screen, one folder per module
    └── components/      one folder per module, mirrors app/admin structure
    └── lib/             one API client + typed wrapper per module, auth context, socket client
```

**Hosting:** not yet decided — see §5/§7 (pending).

## 4. Environment variables

Full detail (including where to obtain each value) lives in `docs/env-registry.md` — reproduced here. **No actual secret values appear in this document or that one; only placeholders.**

| Variable | Used by | Purpose |
|---|---|---|
| `NODE_ENV` | backend | `development` / `test` / `production` — controls error verbosity |
| `PORT` | backend | Port the API + Socket.io server listens on |
| `MONGODB_URI` | backend | MongoDB connection string |
| `CORS_ORIGIN` | backend | Must exactly match the deployed frontend's URL |
| `JWT_ACCESS_SECRET` | backend | Signs the 15-minute access token — generate with `openssl rand -hex 32`, never reuse across environments |
| `JWT_REFRESH_SECRET` | backend | Signs the 7-day refresh token — must differ from the access secret |
| `JWT_ACCESS_EXPIRY` | backend | Access token lifetime (default `15m`) |
| `JWT_REFRESH_EXPIRY` | backend | Refresh token lifetime (default `7d`) |
| `NEXT_PUBLIC_API_BASE_URL` | frontend | The backend's URL — exposed to the browser, never put a secret in a `NEXT_PUBLIC_` variable |

## 5. Credentials & accounts registry — **pending**

No hosting, domain, or third-party accounts have been created yet. This section will list every service the deployed app depends on (MongoDB Atlas or self-hosted, frontend host, domain registrar, etc.), who owns each account, and where access is granted — once those decisions are made in Phase 8. **Actual passwords will go in the client's password manager, never in this document.**

The one credential that exists today is the local development seed account created by `backend/npm run seed`:
- Email: `owner@saffron.dev`
- Password: printed once by the seed script when it runs (also forces a password reset on first login)
- This is a **local development seed only** — a real production Owner account must be created fresh at deployment time, and this seed script should not run against production data.

## 6. Local development setup

Prerequisites: Node.js (LTS), npm, a local or reachable MongoDB instance.

```bash
git clone <repo-url>
cd resturent-pos

# Backend
cd backend
npm install
cp .env.example .env        # fill in JWT_ACCESS_SECRET / JWT_REFRESH_SECRET (openssl rand -hex 32) and MONGODB_URI
npm run seed                # creates a demo restaurant + Owner account, prints the temporary password once
npm run dev                 # http://localhost:5000

# Frontend (separate terminal)
cd frontend
npm install
cp .env.example .env.local  # set NEXT_PUBLIC_API_BASE_URL to the backend URL above
npm run dev                 # http://localhost:3000
```

Useful commands:
```bash
cd backend && npm run build       # production build (dist/)
cd backend && npm run typecheck   # type-check only
cd backend && npm test            # run the automated test suite (Vitest)
cd frontend && npm run build      # production build
cd frontend && npm run lint       # ESLint
cd frontend && npm run typecheck  # type-check only
```

## 7. Deployment & rollback — **pending**

No deployment has happened yet. The PRD's intended model (§10) is Docker Compose for self-hosted on-premise installs, or Next.js + containerized Express + MongoDB Atlas for cloud/SaaS mode — the actual choice, plus the deploy/rollback procedure, will be documented here once Phase 8 runs with the client's hosting decision.

## 8. Backups & data — **pending**

Depends on the hosting decision in §7. MongoDB Atlas provides automated backups out of the box; a self-hosted deployment needs a scheduled `mongodump` (or equivalent) job documented here once chosen.

## 9. Maintenance & troubleshooting

**Routine:**
- Run `npm audit` on both `backend/` and `frontend/` periodically (clean as of this handover — see `docs/05-security-report.md`) and update dependencies with known vulnerabilities.
- JWT secrets should be rotated if ever suspected leaked — this immediately invalidates every active session (by design).
- The in-memory rate limiter and login-lockout tracker (`backend/src/middleware/rate-limit.ts`, `backend/src/utils/login-attempt-tracker.ts`) are per-process. If the API is ever scaled to more than one instance, these need to move to a shared store (Redis) or brute-force protection silently stops working across instances — flagged in both files' own comments.

**Known gaps / accepted trade-offs** (not bugs — deliberate MVP-scope decisions, detailed in `docs/01-product-brief.md`, `docs/02-brand-kit.md`, and each module's own code comments):
- Dish images and the restaurant logo are stored as plain URLs — there's no file-upload/S3 pipeline yet.
- Invoice PDFs are generated on-demand and streamed, not stored anywhere — no "re-download an old invoice" beyond calling the same endpoint again by ID.
- No printer/ESC-POS integration — the invoice PDF is the only "print" path today (download and print manually, or wire a printer bridge later).
- CSV is the only report export format; Excel/PDF export were scoped out.

**Where logs live:** currently just process stdout/stderr on both apps (no centralized log aggregation set up yet) — add one (e.g. Winston/Pino to a file or log service, per the PRD's own §9 recommendation) as part of Phase 8 deployment hardening.

## 10. Support & warranty — **pending**

To be filled in per the commercial agreement with digitecweb once deployment is scheduled.

---

**Traceability:** updated 2026-09-14 for responsive chair-level QR dining, guest identity and visits,
service requests, cancellation invoicing, per-item kitchen estimates, measured production, ingredient-rate
history and dish profitability. Current regression counts and build evidence are recorded in the QA report.
Production dependency audits report zero vulnerabilities. See
`docs/04-test-report.md` and `docs/05-security-report.md` for current evidence.
