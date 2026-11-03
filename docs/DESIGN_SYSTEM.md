# Fantasy Gallery — Design System & UI Engineering Contract (`docs/DESIGN_SYSTEM.md`)

## 1. Product Philosophy & Aesthetic Direction
**Fantasy Gallery** is a personal, self-hosted dark-mode universal wishlist and curation gallery. It treats desired objects like museum pieces in a calm, high-contrast obsidian space—combining **Wealthsimple's** warm editorial clarity on financial numbers with **Linear's** tactile speed and precision.

---

## 2. Color Tokens (True Black Obsidian Palette)
Light mode is intentionally omitted. The canvas is anchored on True Black (`#000000`) so product photography and subtle glass surfaces emerge with depth.

| Token | Value | Purpose |
| :--- | :--- | :--- |
| `--bg-canvas` | `#000000` | Root page background (True Black) |
| `--bg-surface` | `#0A0A0C` | Standard Bento card & header bar surface |
| `--bg-elevated` | `#121216` | Slide-over inspector sheet, active pills, hover surfaces |
| `--bg-image-well` | `#16161B` | Product image backdrop studio well (radial subtle spotlight) |
| `--border-hairline` | `rgba(255, 255, 255, 0.08)` | Default 1px structural border and hairline dividers |
| `--border-interactive` | `rgba(255, 255, 255, 0.18)` | Hover/focus border highlight on interactive surfaces |
| `--text-primary` | `#F7F6F2` | Warm Ivory primary text, hero figures, product titles |
| `--text-secondary` | `#A1A1AA` | Supporting metadata, descriptions, secondary labels |
| `--text-muted` | `#63636E` | Captions, domains, timestamps, disabled controls |
| `--accent-highlight` | `#F59E0B` | Warm Amber for gallery indicator and manual size overrides |
| `--accent-owned` | `#10B981` | Emerald for `Archive / Owned` status |
| `--accent-danger` | `#F43F5E` | Rose for destructive actions and inline error banners |

---

## 3. Typography & Numeric Discipline
- **Primary Sans / Display Font**: `Geist` (`--font-geist-sans`) for all UI labels, product names, prose, and currency amounts.
- **Monospace Font (`Geist Mono`)**: Quarantined **strictly** to raw machine strings (SKU/MPN identifiers, raw domain hostnames in the inspector). **Never** apply `font-mono` to prices, totals, counts, or dates.
- **Tabular Numerals**: Every price, total, percentage, count, and date must carry `font-variant-numeric: tabular-nums` (`.tabular`) and `whitespace-nowrap shrink-0`.
- **Canonical Type Scale & "Max 3 Font Sizes Per Card" Law**:
  1. **Display Hero (`36px–40px`, `font-semibold`, `tracking-tight`, `.tabular`)**: Used once on the page for the Primary Hero Metric (`Total Wishlist Valuation`).
  2. **Card Hero (`20px`, `font-medium`, `tracking-tight`)**: Used for Large & Medium product titles and prices.
  3. **Standard Body / Card Title (`16px`, `font-medium`)**: Used for Small card titles, prices, and inspector fields.
  4. **Micro Metadata (`12px`, `font-medium`, `uppercase tracking-wider`)**: Used for brand names and collection eyebrows.
  *Rule*: Any individual Bento card or summary strip may use **at most 3 font sizes** from this scale.

---

## 4. Subtractive Layout, Dynamic Sizing & Bento Grid Geometry
1. **Minimum Card Radius (`24px`)**: Every Bento card, summary container, and inspector sheet uses `rounded-3xl` (`24px`). Pills and buttons use `rounded-full`.
2. **The "No Box-in-Box" Law**: Never nest a bordered card (`border rounded-xl/2xl/3xl`) inside another bordered card.
3. **Pure Subtractive Cards**: Outside Bento cards show only `Brand · Collection`, product photography, `Title`, and `Price`. Never render size badges (`1×1`, `2×1`) or external action buttons (`✓`, `↗`) on the outside cards; all secondary actions live inside the slide-over inspector.
4. **Dynamic Price-Distribution Sizing (`Small`, `Medium`, `Large`)**:
   - Card sizes are abstracted as **`Small`**, **`Medium`**, and **`Large`** (mapping under the hood to `1×1`, `2×1` horizontal split, and `2×2` showcase spans on desktop).
   - By default (`sizeOverride: null`), `lib/sizing.ts` dynamically assigns `Large` (top ~18% by price), `Medium` (next ~30% by price), and `Small` (remaining items) and interleaves them in alternating 4×2 Bento bands down the scroll.
   - Users can optionally override any item's size to `Small`, `Medium`, or `Large` inside the Inspector Sheet.
5. **Standard `<img>` Tags Only**: Never use `next/image`.
