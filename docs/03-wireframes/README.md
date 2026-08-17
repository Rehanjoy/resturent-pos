# Wireframes — Saffron (Phase 4)

Low-fidelity wireframes: gray boxes, real labels, no colors, no images (per `wireframes.md`). Open any file directly in a browser — nothing is interactive beyond plain links between files for navigation review; there is no styling logic or state.

## Structure

- `00-sitemap.html` — full sitemap, role x screen access matrix, and the 6 key user journeys, step by step. **Start here.**
- One file per MVP screen (9 screens, matching the brief's MVP scope — no Inventory, Reservations, QR Ordering, or Website Builder):
  - `login.html`
  - `dashboard.html`
  - `table-grid.html`
  - `new-order.html` — reference-screenshot layout pattern (category tabs + item grid + right "Bills" rail)
  - `kds.html`
  - `settle-bill.html` — reference-screenshot layout pattern reused (itemized bill + right settlement rail)
  - `menu-management.html` — includes category CRUD + dish CRUD + add/edit dish form in one file
  - `staff-management.html` — includes list + add/edit form + activity log + session management
  - `reports.html` — includes all report tabs (Sales Overview, Revenue by Category, Revenue by Payment Mode, Top Dishes, Staff Performance)

## Conventions used across every screen

- Left nav rail is reproduced identically on all 8 post-login screens. Under each nav icon there's a small role-access tag using this legend: `O`=Owner/Admin, `M`=Manager, `C`=Cashier, `S`=Server/Waiter, `Chef`=Kitchen Staff. No suffix = full access; `(v)` = view only; `(v+add)` = view + add only, no edit/deactivate; `(sales)` = sales reports only, no staff performance; `(partial)` = partial access. This is how "which nav items are role-conditional" is documented on every single screen, not just the sitemap.
- Since the guide forbids color, the KDS elapsed-time escalation (green/yellow/red in the brand kit) and the Table Grid's free/occupied/reserved/needs-cleaning states are represented with **border weight/style + explicit text labels** instead of color, with a legend on each screen explaining the substitution.
- Every screen file ends with a dashed-border **annotation block**: Roles with access, data loaded on entry (entity/API), every button's action + destination, empty state, error state, and any judgment calls that need client confirmation.
- Crossed boxes (`⤬` diagonal lines) stand in for all images/photos (dish photos, avatars, charts-as-placeholders use bracket labels instead).

## Open questions / judgment calls flagged for client sign-off

See the bottom of `00-sitemap.html` for the consolidated list (role landing screens, Dashboard's weekly-trend/low-stock widgets, Settings screen not wireframed this round, Server's table CRUD scope, Reports "sales only" scope for Cashier, discount placement, and Ready-column clearing behavior).
