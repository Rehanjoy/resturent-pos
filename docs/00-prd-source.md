# Product Requirements Document (PRD) — Source
## Restaurant POS & Management System — "Saffron"
**Version:** 1.0
**Stack:** Next.js (Frontend + Admin), Node.js/Express (Backend), MongoDB (Database)
**Deployment Model:** Self-hosted, per-restaurant instance (single-tenant), with multi-tenant-ready architecture for future SaaS scaling
**Prepared for:** digitecweb

> This is the original PRD provided by the client, kept as source-of-truth reference. See `01-product-brief.md` for the working brief derived from this document.

---

## 1. Executive Summary

Saffron is a cloud-capable, self-hostable Restaurant Management Platform covering the complete restaurant operations lifecycle — order taking, kitchen display, table & reservation management, menu & inventory, billing/GST, staff management, analytics, QR-based self-ordering, and an auto-generated public restaurant website. The system must be **bug-free, secure, real-time, and scalable** enough to handle high customer footfall (multiple concurrent orders, kitchen tickets, and QR self-orders) without performance degradation.

### 1.1 Goals
- Zero data loss, zero double-billing, zero order-mismatch between POS and Kitchen.
- Real-time sync across POS terminals, Kitchen Display System (KDS), and QR ordering — under 1 second latency.
- Role-based access so each staff member only sees/does what they're authorized for.
- Works reliably on local network (LAN) even with intermittent internet (for self-hosted on-premise setups), with cloud fallback for SaaS mode.
- Clean, minimal-click UX — an order should be completable in under 5 taps.

### 1.2 Out of Scope (Phase 1)
- Online payment gateway for customer-facing bill settlement (price display only, no online payment collection from end customer at POS).
- Third-party food delivery aggregator integration (Zomato/Swiggy) — planned Phase 3.

---

## 2. User Roles & Permissions (RBAC Matrix)

| Role | Dashboard | Orders | Kitchen (KDS) | Tables/Reservation | Menu | Inventory | Staff | Reports | Website | Settings |
|---|---|---|---|---|---|---|---|---|---|---|
| **Owner/Admin** | Full | Full | Full | Full | Full | Full | Full | Full | Full | Full |
| **Manager** | Full | Full | Full | Full | Full | Full | View/Add | Full | View | Partial |
| **Cashier** | View | Create/Settle | View | View | View | — | — | View (sales only) | — | — |
| **Server/Waiter** | — | Create/Edit | View | Create/Edit | View | — | — | — | — | — |
| **Chef/Kitchen Staff** | — | View (assigned) | Full | — | View | View (deduction only) | — | — | — | — |
| **Inventory Manager** | — | — | — | — | View | Full | — | Inventory reports | — | — |

**Access control principle:** Every API request is validated against JWT claims (`role`, `restaurantId`, `staffId`) — never trust client-side role flags.

---

## 3. Functional Modules

### 3.1 Authentication & Onboarding
- Email/username + password login, JWT (access token 15 min + refresh token 7 days, httpOnly secure cookie).
- Optional PIN-based quick login for POS terminals (staff clock-in/out flow).
- Forced password reset on first login for staff accounts created by Admin.
- Device/session management — Admin can view & revoke active sessions per staff.
- Two-Factor Authentication (2FA) mandatory for Owner/Admin/Manager roles.

### 3.2 Dashboard
- Today's sales summary (gross, net, tax, discounts).
- Payment mode breakdown (UPI / Card / Cash) — pie/bar chart.
- Live operations widget: tables occupied, orders in kitchen, orders ready to serve.
- Top-selling dishes & top-selling categories (real-time, cached with 60s TTL).
- Weekly sales trend graph.
- Low-stock inventory alerts widget.

### 3.3 Order Management (New Order)
- Table selection grid (color-coded: free / occupied / reserved / needs cleaning).
- Menu browsing by category with search & filters (veg/non-veg, spice level).
- Item customization: spice level (mild/medium/spicy), add-ons, special instructions/notes.
- Split order support: send partial items to kitchen, add more later to same table session.
- "Send to Kitchen" action creates a **KOT (Kitchen Order Ticket)** with timestamp.
- Order status lifecycle: `Draft → Sent → In-Kitchen → Ready → Served → Billed → Closed`.
- Order edit/cancel with mandatory reason logging (for audit) if item already sent to kitchen.

### 3.4 Kitchen Display System (KDS)
- Real-time ticket feed via WebSocket (Socket.io) — no polling/refresh needed.
- Ticket shows: table number, items, spice level/notes, elapsed time since order (color escalates: green → yellow → red if delayed beyond configurable SLA, e.g., 15 min).
- "Mark Item Ready" / "Mark All Ready" actions.
- Multi-station routing (optional Phase 2): route items to Tandoor/Main/Bar stations separately.
- Auto-clears ticket from queue upon "Serve" action from POS/Server view.

### 3.5 Table & Area Management
- CRUD for Areas (AC Indoor, Terrace, Garden, etc.).
- CRUD for Tables: name, seating capacity, shape (round/square), area assignment, QR code auto-generation per table.
- Real-time table-status sync across all terminals.

### 3.6 QR Self-Ordering (Customer-Facing)
- Each table has a unique QR — opens mobile-optimized ordering PWA (no app install).
- Customer browses menu, adds items, submits order — lands directly as a "Pending Approval" ticket for the server/cashier to confirm (prevents spam/fraud orders) before hitting kitchen.
- Optional "Call Waiter" button.
- No online payment in Phase 1 — order review & payment happens at table via staff.

### 3.7 Reservation Management
- Create reservation: guest name, phone, party size, date/time, preferred table (optional).
- Reservation calendar/list view with status: `Upcoming / Seated / No-show / Cancelled`.
- Auto table-hold logic: reserved tables blocked in New Order table grid at reservation time ± buffer window.
- SMS/WhatsApp reservation confirmation (via WhatsApp Business API integration).

### 3.8 Menu Management
- Category CRUD (Starters, Tandoor, Main Course, Biryani, Rice, etc. — prebuilt + custom).
- Dish CRUD: name, price, type (veg/non-veg/egg), category, image, description, availability toggle (86'd items), ingredient mapping.
- Ingredient-to-inventory linking: each dish maps to inventory items + quantity consumed per unit sold.
- Bulk import/export via CSV.

### 3.9 Inventory Management
- Inventory item CRUD: name, category (Beverages/Dairy/Grains/Meat/Pantry/etc.), unit, cost, current stock, reorder threshold, supplier.
- **Auto-deduction:** on order confirmation, system deducts mapped ingredient quantities from stock (atomic transaction to prevent race conditions on concurrent orders).
- Low-stock alerts & reorder suggestions.
- Supplier management: name, contact, linked items, purchase history.
- Stock adjustment log (wastage, manual correction) — fully audited.

### 3.10 Billing & Settlement
- Auto bill generation with itemized list, GST/VAT (configurable % from Settings, supports multiple tax slabs — CGST/SGST split for India).
- Discount application: flat or percentage, with manager-approval lock for discounts above a configurable threshold.
- Payment mode recording: Cash / Card / UPI / Split-payment across modes.
- Invoice PDF generation (auto-numbered, sequential, tamper-evident) — print via connected thermal/ESC-POS printer or save/download.
- Refund/void bill flow — restricted to Manager/Owner, fully audit-logged.

### 3.11 Staff Management
- Add/Edit/Deactivate staff: name, email, phone, role, PIN/password.
- Shift scheduling (Phase 2).
- Activity audit log per staff (logins, orders created, discounts applied, voids).

### 3.12 Reports & Analytics
- Filters: Today / Yesterday / Last 7 days / This Month / Custom range.
- Revenue by hour, by category, by payment mode.
- Top-performing dishes, slow-moving items.
- Inventory consumption reports, wastage reports.
- Staff performance (orders handled, average table turnaround).
- Export to CSV/Excel/PDF.

### 3.13 Website Builder Module
- Auto-generated public restaurant website (hero section, about, gallery, live menu with prices synced from Menu module, location map, contact).
- Admin-editable: hero banner image, description text, gallery images (stored in S3/cloud storage).
- SEO-friendly (meta tags, structured data — Schema.org Restaurant markup).

### 3.14 Settings
- Restaurant profile (name, logo, address, GST number).
- Tax configuration (multiple tax types/rates).
- Discount policy configuration.
- Payment mode toggles.
- Printer configuration (ESC-POS/network printer IP).
- Notification preferences (WhatsApp/SMS/Email).

---

## 4. Non-Functional Requirements

| Category | Requirement |
|---|---|
| **Performance** | Order creation API response < 300ms (p95); KDS ticket delivery < 1s via WebSocket |
| **Concurrency** | Support 50+ concurrent orders / 20+ concurrent POS-KDS connections per restaurant instance without lag |
| **Availability** | 99.9% uptime target for cloud/SaaS mode; local-first resilience for self-hosted |
| **Scalability** | Horizontal scaling via stateless Node.js API instances behind load balancer; MongoDB replica set |
| **Data Integrity** | Atomic transactions for order billing + inventory deduction (MongoDB multi-document transactions) |
| **Auditability** | Every financial action (discount, void, refund, price edit) logged with staff ID, timestamp, before/after values |
| **Backup** | Automated daily DB backups (retained 30 days), point-in-time recovery for cloud deployments |
| **Browser/Device Support** | Responsive across desktop POS terminals, tablets (KDS/waiter app), and mobile (QR ordering PWA) |

---

## 5. System Architecture

### 5.2 Frontend
- **Next.js (App Router)** — separate route groups for `/admin` (POS/Dashboard), `/order/[tableId]` (QR PWA, public but token-gated), and `/(website)` (public restaurant site, SSG/ISR for SEO).
- State management: React Query (server state/caching) + Zustand (UI state).
- Real-time: Socket.io client subscribed to restaurant-scoped rooms (`restaurant:{id}:kitchen`, `restaurant:{id}:orders`).

### 5.3 Backend
- **Node.js + Express** REST API, modular controller-service-repository pattern.
- **Socket.io server** scoped by `restaurantId` rooms.
- **Redis**: session store, rate-limiting counters, pub/sub backbone for Socket.io horizontal scaling, dashboard stat caching.
- Background job queue (BullMQ + Redis) for: invoice PDF generation, WhatsApp notifications, report exports, low-stock alert emails.

### 5.4 Database (MongoDB) — Core Collections
`restaurants`, `users`, `areas`, `tables`, `categories`, `menuItems`, `orders`/`orderItems`, `kots`, `inventoryItems`, `inventoryTransactions`, `suppliers`, `reservations`, `invoices`, `payments`, `auditLogs`, `websiteContent`.

All restaurant-scoped collections carry `restaurantId` with compound indexes (`{restaurantId: 1, status: 1}`, `{restaurantId: 1, createdAt: -1}`).

### 5.5 File Storage
- Images (dish photos, gallery, logos) — AWS S3, served via CloudFront CDN.
- Generated invoices — S3 with signed URLs (auto-expiring).

---

## 6. API Design (Endpoints Overview)

See full endpoint list in original PRD — Auth, Orders, Kitchen, Tables & Areas, Reservations, Menu, Inventory, Billing, Staff, Reports, Website, QR Ordering (public), Real-time WebSocket Events.

---

## 7. Security Architecture

- HTTPS/TLS everywhere; HSTS enforced.
- JWT (short-lived access + rotating refresh tokens), httpOnly + Secure + SameSite=Strict cookies.
- RBAC enforcement at middleware level on every route.
- Input validation (Zod/Joi) on every API input; Mongoose parameterized queries (prevents NoSQL injection).
- Rate limiting (Redis-backed) on auth and public QR-ordering endpoints.
- CSRF protection on state-changing admin requests.
- Immutable audit logging (append-only) for all financial/critical actions.
- Sensitive fields (staff PII) encrypted at rest.
- Tenant isolation: every query scoped by `restaurantId` derived from session, never client-supplied.
- Secrets via `.env` + secrets manager for production.
- Dependency vulnerability scanning in CI.
- Sequential, non-editable invoice numbering; audit trail on void/refund.

---

## 8. UX Principles

- Speed-first POS UX: new order in ≤5 taps.
- Real-time visual feedback across all connected devices.
- Color-coded urgency on KDS tickets.
- Error prevention over error messages.
- Offline resilience (self-hosted/LAN mode) with optimistic UI + background sync.
- Minimal training curve.
- Accessibility: WCAG AA contrast, large font option.
- Mobile-first QR ordering.

---

## 9–12. QA Strategy, Deployment, Roadmap, Success Metrics

See original PRD for full detail — Jest/Playwright testing, Docker/CI-CD deployment (self-hosted Docker Compose + cloud SaaS mode), 3-phase roadmap (MVP → Inventory/QR/Reservations/Website → Multi-station/Analytics/Delivery integrations/Multi-branch), and success metrics (order-to-kitchen <1s p99, zero billing mismatches, 99.9% uptime).
