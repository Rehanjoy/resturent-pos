# Product Brief — Saffron (Restaurant POS & Management System)

## Staff workspace controls and KDS reliability — implemented 2026-09-14

Chef accounts default to Orders, Kitchen, Menu and Inventory. Kitchen and Orders receive the read-only
table metadata needed to label tickets, while table configuration and operational mutations remain
separately protected. Owner/Manager can choose which role-eligible workspaces appear for each staff
account from the Add/Edit Staff form. The selection is stored per user and returned by every login,
refresh and current-user response; it never expands the role's server-side permissions.

Authentication now renders the same initial state on server and browser to prevent React hydration
failures. Permission failures are not retried automatically, avoiding repeated 403 traffic during a busy
service. KDS presents a clear retry action and distinguishes an access configuration issue from a network
failure.

## Unified seating and transparent guest ordering — implemented 2026-09-14

Tables, chairs, QR codes, bookings and active visits now share one floor workspace. Selecting the table
centre means a whole-table booking; selecting chair buttons means a chair booking, including a group
across multiple tables. A whole-table occupation highlights the complete table in red, while a shared
table highlights only the occupied chairs. Every guest order is assigned to an active waiter when one is
available, and water, bill and help requests carry the exact session and seat context.

Guests can add more food after their first kitchen submission. Each submission is retry-safe and becomes
its own KOT without duplicating inventory deductions. Cancellation is selected by item and quantity and
uses each line's own kitchen-send time. The order keeps the original quantities plus an audit record of
what was cancelled, the free/half/full charge percentage, tax and amount due. The guest and staff views
both show the same bill components. For example, a ₹260 taxable base with CGST 9% and SGST 9% is shown as
₹260 + ₹23.40 + ₹23.40 = ₹306.80 rather than only showing the final number.

Completing payment moves the reserved chairs or whole table to Cleaning. Staff then use the same floor
workspace to confirm cleaning and mark the seating Available for the next guest.

## Food-cost and menu-profit engineering — implemented 2026-09-14

Inventory is organised as one category-based ingredient register with stock, purchase rate, supplier,
reorder point, daily movement, total stock value, linked-dish count and a rate-change history. Standard
recipes link those ingredients to a measured batch yield. Kg recipes can be entered in grams and litre
recipes in millilitres; the saved base quantity retains up to six decimal places. The system never
infers a conversion between mass and volume.

Each dish receives a live cost sheet: exact ingredient contribution, configurable wastage allowance,
shared overhead allocation, packaging, direct labour, utilities, other per-portion costs, total cost,
contribution, food-cost percentage, margin, break-even price and a suggested price that satisfies the
restaurant's own targets. Missing recipes or zero purchase rates are shown as incomplete. A positive but
below-target dish is labelled low margin; loss is reserved for a selling price below estimated full cost.

Owners can test a different pre-tax selling price and supplier/seasonal rates without changing live data,
then explicitly apply only the selling price if desired. Preferred seasonal months are staff-entered local
knowledge rather than a weather forecast. Recent fulfilled portions are valued at current prices and rates
and clearly labelled as a current-cost estimate, because historical recipe-cost snapshots are not available.

## Guest service and production intelligence — implemented 2026-09-13

Every QR booking now captures the guest's name and mobile number before seating. A visit record tracks
party size, selected chairs, time spent, order value and paid value. The Customers workspace lets
authorised staff recognise returning guests and apply a factual Normal, Good guest, VIP or Service
attention label with private notes. Labels are staff decisions; the system does not automatically give
a guest a negative label.

Guests can request water, the bill or staff help from their active QR session. The floor receives the
request in real time with a polling fallback, highlights the relevant table and chair, and supports
acknowledged and completed states. Kitchen item changes appear as accessible in-app notifications, so
the guest can follow each dish from queued through preparation to ready with its current ETA.

Inventory now includes standard batch recipes and a daily production worksheet. For example, a biryani
recipe records the measured rice, oil and other ingredients used by one batch plus the number of
portions it yields. Planned portions calculate exact ingredient needs, cost and shortage before service;
actual kitchen orders remain the stock-deduction source to prevent double counting. A closed-day
reconciliation compares recorded use and waste with weighed actual values and posts only the difference,
once. Quantities retain up to six decimal places; real-world 10 g accuracy depends on staff entering
weighed measurements in the source unit.

## Dining operations enhancement — implemented 2026-09-10

The floor now works at chair level. Each chair has its own QR code; a guest can scan one chair,
enter the party size, and select available chairs across one or more tables. Different parties can
occupy different chairs at the same table without sharing an order or bill. Customer selections are
held for a configurable five-minute default and released when no order is placed. Staff-created seating
has no countdown and stays occupied until staff releases it after settlement.

Customer QR orders show a server-time countdown, menu photos, customization, counter-payment guidance,
item preparation estimates and live kitchen state. The cancellation policy is stored with each order:
by default cancellation is free before 8 minutes, charged at 50% from 8 to under 10 minutes, and charged
in full from 10 minutes. The guest reviews the current server-calculated amount before confirming.
Managers can change future-order policy values and per-dish preparation times; kitchen staff can revise
a live item's ETA.

Inventory records receipts, use, waste and corrections separately, shows daily movements in India
Standard Time, accepts planned daily usage, calculates projected days remaining, and raises low or
critical alerts at the configured reorder threshold.

**Client:** digitecweb
**Source:** `00-prd-source.md` (client-provided PRD, v1.0)
**Status:** Draft — awaiting client approval

---

## 1. Product Vision

Saffron is a self-hostable, real-time restaurant management platform that takes a restaurant from order to bill without data loss, double-billing, or POS/kitchen mismatch — covering order taking, kitchen display (KDS), table & reservation management, menu & inventory, GST billing, staff management, analytics, QR self-ordering, and an auto-generated public website. Built to stay usable on unreliable restaurant Wi-Fi and trainable by high-turnover staff in minutes, not days.

## 2. Client Decisions (locked for this build)

- **Login method:** Email + password (not username). PIN-based quick login remains available for POS terminal clock-in, per PRD §3.1.
- **UI reference:** Client supplied a reference screenshot for the **New Order / Billing screen** — this sets the visual language for POS screens:
  - Warm coral/red primary accent on a light neutral background.
  - Left-hand icon-only vertical nav rail.
  - Top bar: search input + logged-in staff identity (avatar, name, role).
  - Horizontal category tabs with icon + label (e.g. Popular, Rice Bowl, Coffee, Snack, Dessert, Salad), active tab outlined in accent color.
  - Menu grid as image-forward cards: dish photo, name, price per unit, inline customization (radio-style options like spice level / add-on), primary "Add to Billing" button on the focused card.
  - Right-hand persistent **Bills** panel: line items with thumbnail, name, variant note, qty stepper (+/-), price; running Subtotal / Discount / Tax / Total; Payment Method selector (Cash / Card / UPI icons); bottom-fixed primary CTA.
  - This card + right-rail-cart pattern becomes the base layout for both the **New Order** screen and the **Settle Bill** screen (PRD §3.3, §3.10).

## 3. User Roles (from PRD §2 RBAC matrix)

| Role | Summary |
|---|---|
| Owner/Admin | Full access to everything |
| Manager | Full ops access; partial Settings; approves discounts/voids above threshold |
| Cashier | Create/settle orders, view-only dashboard & sales reports |
| Server/Waiter | Create/edit orders & reservations, view menu/KDS — no billing/reports |
| Chef/Kitchen Staff | Full KDS control, view assigned orders, view-only inventory (deduction visibility) |
| Inventory Manager | Full inventory + supplier control, inventory reports only |

Enforcement: JWT claims (`role`, `restaurantId`, `staffId`) checked server-side on every route — never client-trusted.

## 4. Feature List

### MVP (Phase 1 — build first)
- Auth: email + password login, JWT (15 min access / 7 day refresh, httpOnly cookie), PIN quick-login for terminals, forced reset on first login, 2FA for Owner/Admin/Manager
- RBAC middleware across all API routes
- Table & Area management (CRUD, color-coded status grid)
- New Order flow: table → category → item (with customization) → cart → send to kitchen (KOT)
- Kitchen Display System: real-time ticket feed (Socket.io), elapsed-time color escalation, mark ready
- Menu management: categories + dishes, availability toggle, veg/non-veg/spice metadata
- Billing & Settlement: itemized bill, GST (CGST/SGST configurable), discounts with approval lock, payment mode recording (cash/card/UPI/split), sequential invoice numbering, PDF generation
- Staff management: add/edit/deactivate, roles, activity audit log
- Dashboard: three responsive analytics workspaces — Earnings (today's sales, payment mix, seven-day revenue, demand and live operations), Staff (seven-day output and service speed), and Inventory (live stock value, coverage, health and reorder risk). Staff and Inventory detail is limited to Owner/Manager accounts that have the matching workspace enabled.
- Persistent operational notifications: role/user-targeted staff inbox and guest visit activity for new kitchen batches, ready/served orders, water/help/bill calls, acknowledgement, payment and cleaning. Socket delivery gives live wake-ups; the database inbox, reconnect refresh and recovery polling preserve missed updates.
- Basic reports: sales by date range, export CSV
- Audit logging for all financial actions (discount, void, refund, price edit)

### Pulled forward from Phase 2 into active development (2026-08-18, client request)
- **Inventory management** — item/supplier/category CRUD, append-only stock-transaction ledger, ingredient-to-dish mapping, atomic per-ingredient deduction triggered on send-to-kitchen (the closest real analogue this app has to "order confirmation" — no separate confirm step exists), low-stock dashboard widget. Shipped.
- **Reservation management** — date-filtered list, table auto-hold triggered by concrete staff actions (assign table / seat / cancel / no-show) rather than a time-window/cron job, since no job scheduler exists in this codebase yet. Shipped.
- **Website builder module** — admin content editor (Owner: full, Manager: view-only per the RBAC matrix) plus a real public, unauthenticated, rate-limited restaurant site with SEO metadata and Schema.org structured data. Shipped.

### Still Phase 2/3 (not yet built)
- WhatsApp/SMS notifications (reservation confirmations, low-stock alerts) — no provider integration exists yet
- Multi-station KDS routing, shift scheduling, advanced analytics/forecasting, delivery aggregator integrations, multi-branch support

### Phase 3 (later)
- Multi-station KDS routing (Tandoor/Main/Bar)
- Shift scheduling
- Advanced analytics/forecasting
- Delivery aggregator integrations (Zomato/Swiggy)
- Multi-branch support for restaurant chains

## 5. Data Entities (MongoDB collections)

`restaurants`, `users` (staff), `areas`, `tables`, `diningFloors`, `customerVisits`, `serviceRequests`, `categories`, `menuItems`, `productionPlans`, `productionReconciliations`, `orders` (with embedded/denormalized order items), `kots`, `inventoryItems`, `inventoryTransactions`, `suppliers`, `reservations`, `invoices`, `payments`, `auditLogs`, `websiteContent`.

All restaurant-scoped collections carry `restaurantId` with compound indexes for tenant isolation — architecture is multi-tenant-ready even though Phase 1 ships single-tenant/self-hosted per restaurant.

## 6. Integrations

- **Socket.io** — real-time order/kitchen/table sync (<1s target)
- **Redis** — session store, rate limiting, Socket.io pub/sub scaling, dashboard cache, BullMQ job queue
- **AWS S3 + CloudFront** — dish photos, gallery images, invoice PDFs
- **WhatsApp Business API** — reservation confirmations, notifications (Phase 2)
- **ESC-POS / thermal printer (LAN bridge)** — invoice/KOT printing
- No online payment gateway in Phase 1 (price display + manual payment-mode recording only)

## 7. Non-Functional Targets

- Order creation API < 300ms p95; KDS ticket delivery < 1s
- 50+ concurrent orders / 20+ concurrent POS-KDS connections per instance
- Atomic MongoDB transactions for billing + inventory deduction
- Local-first resilience on LAN with intermittent internet (self-hosted mode)
- WCAG AA contrast for kitchen environments

## 8. Rough Milestones

1. **Scaffold + Auth + RBAC** — project setup, DB models, email/password login, role middleware
2. **Core ops loop** — Tables/Areas, Menu, New Order, KDS, Billing/Settlement (this is the deployable MVP core)
3. **Staff + Dashboard + Reports** — completes MVP
4. **QA pass** — automated tests on billing/tax math, manual checklist per screen
5. **Security audit** — auth, RBAC, injection, secrets, rate limiting
6. **Deploy** — staging → production, smoke test
7. **Handover** — docs, env registry, credentials registry

Phase 2/3 items scheduled after MVP is live and validated with the client.

---

**Next step:** Phase 3 — Brand kit (colors, fonts, logo) built to match the coral/warm palette from your reference screenshot, then Phase 4 — wireframes for the 5 highest-traffic screens (New Order, KDS, Settle Bill, Table Grid, QR Ordering).
