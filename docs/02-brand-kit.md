# Brand Kit — Saffron (Restaurant POS & Management System)

**Client:** digitecweb
**Status:** Draft — awaiting client approval
**Anchor:** Client-supplied reference screenshot (New Order / Billing screen) — warm coral/red primary on a soft light-neutral background, dark charcoal text, card UI with soft shadows and rounded corners.

---

## 1. Color Palette

The palette is built around the client's coral/red reference. Everything else (secondary, semantic set) is chosen to work *alongside* that coral without fighting it — this matters specifically because the Kitchen Display System (KDS) uses a green → yellow → red urgency escalation (PRD §3.4), so the semantic `error` red had to be deliberately separated from the brand `primary`/`accent` coral (different hue angle, darker/more saturated, and reserved for icon+label contexts rather than large fields) so a "table is overdue" ticket never reads as "brand color" and vice versa.

| Role | Hex | Usage rule |
|---|---|---|
| **Primary** | `#E53E15` | Brand identity color — active navigation, category-tab outline, links, focus rings, logo mark. |
| **Secondary** | `#1F7A8C` | Supporting/cool counterweight to the warm primary — secondary buttons (Cancel, Save Draft), informational tags/chips (table-area labels, order-status pills that aren't financial), non-primary UI accents. Never used for CTAs or urgency/error states. |
| **Accent (CTA only)** | `#FF4B24` | Reserved for the primary action per screen: add, send, settle, save. |
| **Background** | `#FFF3F0` | Soft blush app canvas, matching the approved visual reference. |
| **Surface** | `#FFFFFF` | Cards, panels, the right-hand Bills rail, modals — sits on top of Background with a soft shadow + rounded corners, per the reference screenshot's card language. |
| **Text** | `#191919` | Primary charcoal text for strong contrast. |
| **Text Muted** | `#706B69` | Secondary text — timestamps, helper text, placeholder copy, table meta rows. |
| **Border** | `#EEE7E4` | Quiet card borders, dividers and input outlines. |

### Semantic colors (also power the KDS urgency escalation)

| Role | Hex | Usage rule |
|---|---|---|
| **Success** | `#15803D` | Order confirmed, payment successful, KDS "on time" ticket state (elapsed time within SLA). Passes AA with white text (4.6:1+). |
| **Warning** | `#D97706` | KDS "getting late" ticket tier (approaching SLA threshold), low-stock alerts, pending-approval QR orders. **Always paired with dark text (`#2B2420`), not white** — contrast with white is only 3.2:1 (AA-large, not full AA). |
| **Error** | `#DC2626` | KDS "overdue" ticket tier (breached SLA), destructive actions (void, refund, delete), validation errors. Deliberately a darker, more saturated, more blue-leaning red than Primary (hue ~0° vs. ~6°, luminance ~31% lower) so it never gets mistaken for the brand coral — reserve for icon + label combos, never a full-bleed background. Passes AA with white text (4.8:1). |
| **Info** | `#2563EB` | Neutral system messages, informational banners, "new order received" toast. Passes AA with white text (5.2:1). |

### CSS variables (for the coding phase)

```css
:root {
  /* Brand */
  --color-primary: #E53E15;
  --color-secondary: #1F7A8C;
  --color-accent: #FF4B24;

  /* Neutrals */
  --color-bg: #FFF3F0;
  --color-surface: #FFFFFF;
  --color-text: #191919;
  --color-text-muted: #706B69;
  --color-border: #EEE7E4;

  /* Semantic (also drives KDS ticket urgency: success -> warning -> error) */
  --color-success: #15803D;
  --color-warning: #D97706;
  --color-error: #DC2626;
  --color-info: #2563EB;
}
```

### Contrast / accessibility notes (WCAG AA per PRD §8 "Accessibility: WCAG AA contrast, large font option")

- `--color-text` on `--color-bg` / `--color-surface`: **14.3:1 / 15.8:1** — comfortably passes AA (4.5:1) and AAA (7:1). This is the pairing used for all body copy, table rows, and reports.
- `--color-text-muted` on `--color-bg` / `--color-surface`: **5.7:1 / 6.1:1** — passes AA for normal text.
- White text on `--color-primary` / `--color-accent`: **3.6:1 / 3.1:1** — this is **AA-large only**, not full AA, which is typical of bright coral/orange brand colors (Zomato, Swiggy have the same constraint). **Mitigation baked into the type scale below: all CTA/button labels are set at 16px Inter SemiBold minimum**, which qualifies as "large text" under WCAG 1.4.3 and legitimately meets the 3:1 AA-large threshold. Never place primary/accent as a background behind body-copy-sized (< 16px) text.
- White text on `--color-secondary`, `--color-success`, `--color-error`, `--color-info`: all pass full AA (4.5:1+) — safe for any text size.
- `--color-warning` requires dark text (`--color-text`), documented above.

---

## 2. Fonts

**Heading:** [Poppins](https://fonts.google.com/specimen/Poppins) — geometric, rounded, friendly; reads warm/appetizing without sacrificing legibility, and is the guide's recommended pairing for retail/hospitality products.

**Body:** [Inter](https://fonts.google.com/specimen/Inter) — purpose-built for UI at small sizes, excellent legibility on tablets and in dense report tables, has proper tabular figures for bill/report numerals.

**Weights to load (4 total, kept lean for performance):**
- Poppins 600 (SemiBold) — all headings (h1–h4), logo wordmark
- Inter 400 (Regular) — body copy, table cells
- Inter 500 (Medium) — form labels, secondary emphasis
- Inter 600 (SemiBold) — button/CTA labels, table headers, KDS elapsed-time readout

```css
:root {
  --font-heading: 'Poppins', 'Segoe UI', sans-serif;
  --font-body: 'Inter', 'Segoe UI', sans-serif;
}
```

### Type scale

| Token | Size | Font / Weight | Line-height | Used for |
|---|---|---|---|---|
| `h1` | 32px / 2rem | Poppins 600 | 1.25 | Page titles (Dashboard, Reports) |
| `h2` | 24px / 1.5rem | Poppins 600 | 1.3 | Section/card headers, modal titles |
| `h3` | 20px / 1.25rem | Poppins 600 | 1.35 | Panel titles, KDS station headers |
| `h4` | 16px / 1rem | Poppins 600 | 1.4 | Widget titles, small headers |
| `body` | 15px / 0.9375rem | Inter 400 | 1.5 | Default UI text, menu item names, table cells |
| `small` | 13px / 0.8125rem | Inter 400 | 1.4 | Captions, timestamps, helper text |
| `button` | 16px / 1rem | Inter 600 | 1 | All CTA/button labels — sized to satisfy AA-large contrast on coral buttons (see contrast note above) |
| `numeric` | 15–20px | Inter 500/600, `font-variant-numeric: tabular-nums` | 1.3 | Bill totals, report tables, KDS elapsed-time clocks |

```css
:root {
  --text-h1: 600 2rem/1.25 var(--font-heading);
  --text-h2: 600 1.5rem/1.3 var(--font-heading);
  --text-h3: 600 1.25rem/1.35 var(--font-heading);
  --text-h4: 600 1rem/1.4 var(--font-heading);
  --text-body: 400 0.9375rem/1.5 var(--font-body);
  --text-small: 400 0.8125rem/1.4 var(--font-body);
  --text-button: 600 1rem/1 var(--font-body);
}
```

---

## 3. Logo

### Concepts considered

1. **Saffron Thread mark (chosen)** — three tapered, curved "thread" shapes radiating from a center point, echoing the real saffron spice's thread-like red stigmas while also reading as a compact flame/pinwheel. Directly literal to the product name, renders as flat single-color shapes so it survives at 32px, and naturally uses the coral primary as its one fill color.
2. **Order-flow ticket mark** — a rounded-corner ticket/receipt silhouette with a small check-mark notch, referencing the KOT (Kitchen Order Ticket) that is the product's core operational unit. Very literal to "POS/ops tool," builds operational trust, but reads more generic (looks like many receipt/invoice app icons) and doesn't tie to the "Saffron" name.
3. **Bowl + spark mark** — a minimal bowl silhouette with a small flame/spark accent at the rim ("hot food, ready fast"). Warm and appetizing, avoids the fork/knife/chef-hat clichés, but is visually busier at 32px (two shapes competing) and needs two colors to read clearly, which fights the "flat, simple, works at favicon size" requirement.

Concept 1 was built because it is simplest at small sizes, uses exactly one palette color, and is the only concept that ties directly to the product name "Saffron" rather than to restaurants generically — important since individual restaurants get their own branding later via the Website Builder module (PRD §3.13); this mark only needs to represent the *software product* itself (POS chrome, login screen, staff-facing admin, invoice footer "Powered by Saffron").

### Files delivered

- `assets/logo.svg` — full lockup (mark + wordmark), light-background variant, dark charcoal wordmark. Default logo for the admin/POS chrome on the light-neutral background.
- `assets/logo-dark.svg` — same mark, wordmark switched to warm off-white (`#FAF7F5`) for use if a dark sidebar/header treatment is adopted during wireframing/coding.
- `assets/logo-mark.svg` — icon only, no wordmark, for favicon, browser tab icon, PWA app icon (QR ordering PWA), and the collapsed state of the left icon-only nav rail described in the reference screenshot.

Construction rules followed: flat fill only (`#E8564A`), no gradients/filters/effects, tested to remain legible as a distinct 3-petal shape at 32px and shows the tapered thread detail cleanly at 300px.

---

## 4. Tone of Voice

**Adjectives:** Fast, Confident, Plainspoken, Unfussy.

The audience is restaurant owners, cashiers, servers, and kitchen staff — mostly non-technical, often new to the job (high turnover per the brief), working under time pressure on a POS tablet or KDS screen. Copy should read like a capable coworker giving a quick, clear instruction — never like enterprise software apologizing for itself. No jargon, no exclamation-point cheerfulness, no hedging ("Oops! Something went wrong, please try again"). State what happened and what to do next, in that order.

**Example UI copy:**

- Empty state (Table Grid, no tables set up yet): *"No tables yet. Add your first table to start taking orders."* — with a single primary button: "Add Table."
- Error state (KOT send fails, e.g. kitchen printer/socket offline): *"Order not sent to kitchen — check your connection and try again."* — never "An error occurred" with no next step.
- Confirmation (bill settled): *"Bill #1042 settled — ₹1,240 via UPI."*
- Validation (discount above threshold, needs manager approval): *"This discount needs manager approval. Ask a manager to confirm."*

---

### Premium glass surface system

Glass is a structural material for navigation, dialogs, notification drawers, toasts, and focused action surfaces. Operational rows and dense reports remain opaque for fast scanning.

| Token | Value | Use |
|---|---|---|
| Canvas deep | `#F8E8E2` | Warm lower layer in the ambient page gradient. |
| Glass | `rgba(255,255,255,0.72)` | Navigation and light floating controls. |
| Glass strong | `rgba(255,255,255,0.90)` | Dialogs, drawers, login and priority overlays. |
| Glass border | `rgba(255,255,255,0.82)` | Highlight edge that keeps translucent surfaces legible. |
| Soft shadow | `0 12px 34px rgba(86,43,25,0.08)` | Cards and low elevation controls. |
| Float shadow | `0 22px 60px rgba(86,43,25,0.14)` | Modals and attention surfaces. |

Use `backdrop-filter` with a solid white fallback. Respect `prefers-reduced-transparency` and `prefers-reduced-motion`. Touch targets remain at least 44px and text continues to use the established contrast-safe palette.

---
## 5. Traceability to source docs

- Coral palette range, card UI, soft shadows, rounded corners: `01-product-brief.md` §2 (client-supplied reference screenshot).
- KDS green/yellow/red urgency escalation driving the semantic color set: `00-prd-source.md` §3.4.
- WCAG AA contrast requirement: `00-prd-source.md` §4 (Non-Functional Requirements) and §8 (UX Principles).
- Product name "Saffron" informing the logo concept: `01-product-brief.md` title / `00-prd-source.md` title.
