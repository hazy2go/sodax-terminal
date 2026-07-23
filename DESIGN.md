# Design

Visual system for SODAX Terminal. Register: product (Operate). Sleek, modern, premium; data is the interface.

## Theme

Dark only. Pure-neutral near-black ground (chroma 0, no hue tint). The mood lives in the primary and the data colors, never in the surface. No gradients, no glass, no glow. Depth comes from 1px borders and two surface steps, not shadows.

## Color (OKLCH only)

| Token | Value | Role |
|---|---|---|
| `--bg` | `oklch(0.13 0 0)` | app ground |
| `--surface` | `oklch(0.165 0 0)` | panels, table headers |
| `--raised` | `oklch(0.205 0 0)` | hover rows, menus, inputs |
| `--line` | `oklch(0.26 0 0)` | 1px borders everywhere |
| `--line-strong` | `oklch(0.34 0 0)` | focused/active borders |
| `--ink` | `oklch(0.93 0 0)` | body text (≥7:1 on bg) |
| `--muted` | `oklch(0.66 0 0)` | secondary text (≥3.5:1) |
| `--faint` | `oklch(0.50 0 0)` | tertiary labels only, never body |
| `--primary` | `oklch(0.62 0.20 353)` | actions, active tab, brand moments |
| `--primary-ink` | `oklch(0.98 0 0)` | text on primary fills |
| `--accent` | `oklch(0.82 0.07 230)` | links, info badges (sparingly) |
| `--up` | `oklch(0.72 0.17 155)` | positive deltas |
| `--down` | `oklch(0.64 0.19 25)` | negative deltas, errors |
| `--warn` | `oklch(0.80 0.14 85)` | warnings, pending |

Strategy: Restrained. Primary covers <10% of any screen. Up/down colors appear only on values, never as decoration. Semantic color is never the sole carrier: deltas are signed, statuses labeled.

## Typography

- **UI / body**: Geist Sans (`--font-geist-sans`), 13px base in dense surfaces, 14px in forms.
- **Data / numerals / labels**: Geist Mono (`--font-geist-mono`) with `font-variant-numeric: tabular-nums`. Every number in the product is mono tabular.
- Scale: 11 / 12 / 13 / 14 / 16 / 20 / 28. Weight contrast (400 vs 600) does hierarchy, not size inflation.
- Uppercase only for ≤2-word mono micro-labels (table headers, tab names, statuses) at 11px with 0.08em tracking.

## Layout

- Full-width app shell: top bar (48px) → tab nav (40px) → content region, max-width 1440px centered, 20px gutters.
- Spacing scale: 4 / 8 / 12 / 16 / 24 / 32.
- Radius: 6px panels/inputs, 4px badges, 0 on table cells. Nothing pill-shaped except status dots.
- Tables are the core component: 36px rows, mono numerals right-aligned, header row on `--surface` with 11px mono uppercase labels, row hover `--raised`.

## Motion

- 140ms `cubic-bezier(0.22, 1, 0.36, 1)` for hovers/menus; 240ms for panel/tab transitions.
- Live data changes flash the value's own color at 12% background for 600ms, then decay. No pulsing idle animations.
- `prefers-reduced-motion`: all transitions become instant; data flashes become plain swaps.

## Components

- **Buttons**: primary = `--primary` fill + `--primary-ink` text; secondary = transparent + 1px `--line` border; both 32px tall, 6px radius, verb+object labels.
- **Inputs**: `--raised` fill, 1px `--line`, focus ring 2px `--primary` at 40% outside.
- **Badges/status**: 4px radius, mono 11px, tinted bg at 15% of the semantic color + full-strength text.
- **Panels**: `--surface`, 1px `--line`, 6px radius, 16px padding, mono 11px uppercase panel titles.

## Never

Side-stripe borders, gradient text, glassmorphism, glow shadows, purple/teal gradients, orange-on-black retro terminal styling, identical stat-card grids, eyebrow kickers.
