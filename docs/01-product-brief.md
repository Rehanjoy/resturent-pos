# Product Brief — Saffron (Restaurant POS & Management System)

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
- Dashboard: today's sales, payment mode breakdown, live table/kitchen widget, top dishes
- Basic reports: sales by date range, export CSV
- Audit logging for all financial actions (discount, void, refund, price edit)

### Pulled forward from Phase 2 into active development (2026-08-18, client request)
- **Inventory management** — item/supplier/category CRUD, append-only stock-transaction ledger, ingredient-to-dish mapping, atomic per-ingredient deduction triggered on send-to-kitchen (the closest real analogue this app has to "order confirmation" — no separate confirm step exists), low-stock dashboard widget. Shipped.
- **Reservation management** — date-filtered list, table auto-hold triggered by concrete staff actions (assign table / seat / cancel / no-show) rather than a time-window/cron job, since no job scheduler exists in this codebase yet. Shipped.
- **Website builder module** — admin content editor (Owner: full, Manager: view-only per the RBAC matrix) plus a real public, unauthenticated, rate-limited restaurant site with SEO metadata and Schema.org structured data. Shipped.

### Still Phase 2/3 (not yet built)
- QR self-ordering PWA (pending-approval gate before kitchen)
- WhatsApp/SMS notifications (reservation confirmations, low-stock alerts) — no provider integration exists yet
- Multi-station KDS routing, shift scheduling, advanced analytics/forecasting, delivery aggregator integrations, multi-branch support

### Phase 3 (later)
- Multi-station KDS routing (Tandoor/Main/Bar)
- Shift scheduling
- Advanced analytics/forecasting
- Delivery aggregator integrations (Zomato/Swiggy)
- Multi-branch support for restaurant chains

## 5. Data Entities (MongoDB collections)

`restaurants`, `users` (staff), `areas`, `tables`, `categories`, `menuItems`, `orders` (with embedded/denormalized order items), `kots`, `inventoryItems`, `inventoryTransactions`, `suppliers`, `reservations`, `invoices`, `payments`, `auditLogs`, `websiteContent`.

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
