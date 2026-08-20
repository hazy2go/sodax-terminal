# Design

Visual system for SODAX Terminal, recorded from the built world. Mode: **Operate**.
Direction: **Event Display** (seed `8ff96446`). Lineage: collider detector event displays.

## Thesis

The hub is the beamline. Sonic sits at the centre; every supported spoke chain is a
concentric ring outward; every live intent is a track arcing from its source ring
through the core to its destination. The product's architecture *is* the interface —
which is why this refuses the two arrangements the category always ships: the
stat-card dashboard and the centred swap card.

## Theme

Dark, forced by the use scene: a trader on a laptop in a dark room or office, several
positions live, judging in seconds. Near-black vacuum ground with a faint radial well
behind the detector. Depth comes from 1px hairlines and two surface steps — never from
shadows, glass, or glow.

## Colour

| Token | Value | Role | Contrast on `--vacuum` |
|---|---|---|---|
| `--vacuum` | `#0b0f14` | app ground | — |
| `--vacuum-deep` | `#070a0e` | strip, rail, instrument column, wells | — |
| `--steel` | `#16202b` | row hover | — |
| `--steel-raised` | `#1e2b39` | tooltips, scrollbar | — |
| `--ring-dim` | `#2b405a` | detector ring strokes | 2.9:1 (graphic) |
| `--ring` | `#3a5a7a` | focused borders, gauge fill | 2.7:1 (graphic) |
| `--hairline` | `#1c2836` | 1px separators | — |
| `--hairline-hi` | `#2c4056` | control borders | — |
| `--ink` | `#e6ecf3` | body text | 16.2:1 |
| `--text-steel` | `#a7b3c2` | secondary text | 9.0:1 |
| `--faint` | `#748296` | micro-labels, muted figures | 4.9:1 |
| `--track-yellow` | `#ffd23a` | primary action, tracks, core ring | 13.3:1 |
| `--track-cyan` | `#35d0ff` | tracks, live badges | 10.6:1 |
| `--energy` | `#ff4d4d` | calorimeter bars, errors, negative | 5.9:1 |
| `--viable` | `#4ade80` | positive deltas, confirmations | 11.0:1 |

Strategy: **Restrained** — neutrals plus the signal set. Yellow is the only fill colour
and covers well under 10% of any screen. Colour is never the sole carrier: deltas are
signed, statuses are labelled, the utilisation gauge pairs its bar with the figure, and
the health factor prints `No debt` rather than relying on a green chip.

## Typography

- **UI**: Geist Sans (`--font-ui`), 13px base.
- **Data**: Geist Mono (`--font-data`) with `tabular-nums` — every figure in the product,
  plus micro-labels and control text. Mono here is measurement, not costume.
- **Display**: Archivo variable (`--font-head`), run wide (`wdth` 106–112) for the
  wordmark, instrument titles, and the detector core. A real grotesk with a width axis
  rather than a sci-fi face.
- Micro-labels: 10px mono, uppercase, `0.1em` tracking, `--faint`.

Font variables are declared on `<html>`. Declaring them on `<body>` while composing them
at `:root` silently invalidates the whole `font-family` and falls back to serif.

## Layout

A single full-height grid, no page scroll on desktop:

```
strip strip strip     46px
rail  event instr     1fr
tape  tape  tape      30px
      56px  1fr  404px
```

- **Strip** — wordmark, five live protocol stats, wallet chips.
- **Rail** — four instruments as authored ring glyphs; active marked by a 2px yellow bar,
  never a filled pill. Labels appear on hover and to screen readers.
- **Event** — the detector, always live, never replaced by the instrument.
- **Instrument** — the working surface: form, tables, actions. Scrolls independently.
- **Tape** — the live open-intent crawl.

Below 940px the grid folds to rail + single column with the detector as a 42vh band.
Below 700px controls shrink below their label min-content; below 520px the strip stats
drop. Spacing scale 4 / 6 / 8 / 12 / 14 / 22. Radius: 0 everywhere — the world is ruled,
not rounded.

## Stack

The interface is built on libraries, not hand-rolled CSS. This replaced ~2,500
lines of bespoke stylesheet, DIY dropdown/modal/picker and hand-drawn SVG, which
is what made the first build read as amateur however carefully it was tuned.

- **Tailwind v4** for all styling. The palette below lives in `@theme inline`, so
  every primitive inherits it without per-component overrides.
- **shadcn/ui on Base UI** for primitives — Dialog, Popover, Command,
  DropdownMenu, Select, Tabs, Table, Tooltip, ScrollArea. These own focus traps,
  portalling and keyboard semantics. Base UI composes via a `render` prop, not
  Radix's `asChild`.
- **TanStack Table** (its `legacy` entry point) for the sortable reserve grid.
- **ECharts 6** for the graph. Real tooltip engine, animation, and
  adjacency focus, none of which a hand-drawn SVG was going to match.
- **Lucide** for icons, at `size-[18px]`, stroke 1.5.

Use the primitives. A raw `<div>` standing in for a Popover, or a bespoke
stylesheet block where a token exists, is a regression.

## The graph

The hub and its spokes as an ECharts network graph — the canonical visual for
flow between entities.

- **Nodes are chains.** Size is the money-market liquidity that chain can reach,
  summed over the assets it supports; opacity tracks the same value so the
  ranking reads without hovering. Sonic is the hub, drawn larger with the accent
  ring.
- **Edges are live cross-chain intents**, aggregated per chain pair and weighted
  by count.
- **Hub-local (Sonic→Sonic) intents** are the bulk of the orderbook and are
  reported as a count rather than drawn, since a self-loop carries no direction.
- **Hovering a chain focuses its own flows** and blurs the rest — ECharts
  adjacency focus, free with the library.

Earlier passes drew this by hand: first as concentric rings with per-asset bars
(103 marks encoding the same dozen protocol-wide numbers, in a radially
symmetric starburst that said nothing), then as chain sectors with one wedge
each. Both were legible only after being explained, which is the tell.

## Motion

One authored moment: **the event bloom**, built with anime.js v4 timelines — the core
scales in, rings resolve outward on a stagger, tracks draw from the beamline, calorimeter
bars extend, labels fade up. Everything animates *from an already-visible default*; an
interrupted or failed animation must never leave the diagram blank.

The tape's crawl is the second motion, and it is the tape's native behaviour, not
decoration. Value changes flash their own semantic colour for 620ms. `outExpo` throughout;
140ms for hovers, 260ms for panels. Under `prefers-reduced-motion` the bloom is skipped
entirely, the crawl does not start, and all transitions collapse to instant.

## Components

- **Buttons** — shadcn `Button`. Primary is the accent fill with vacuum ink. The
  disabled state is explicitly re-styled to `bg-secondary`: a 50%-opacity yellow
  on a dark ground reads as muddy olive, not as unavailable. A disabled button
  never carries a "connect wallet" label; that prompt is a `Note` beneath it.
- **Readouts** — label, dotted leader, right-aligned tabular value (`Readout`).
- **Tables** — shadcn `Table`, `label-micro` heads, `fig` cells, tight `px-2`
  gutters so five columns fit the 400px rail.
- **Badges** — outline plus semantic text, never a solid fill.
- **Micro-labels** — the `.label-micro` component class: 10px mono, uppercase,
  0.1em tracking. **Figures** — the `.fig` class, mono with tabular numerals.

## Never

Stat-card grids, centred swap cards, glassmorphism, glow halos, gradient text, rounded
cards, coloured left-border callouts, scanlines or CRT costume, purple/teal DeFi
gradients, emoji or unicode standing in for icons, a disabled button as a call to action.
