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

## The detector

- 20 concentric rings, one per supported spoke chain, `FIRST_R 84` + `18.5` gap, in a
  1180×1000 user-space box. Sonic is the core at `r 52`, not a ring.
- **Calorimeter bars**: a radial bar chart on the right arc. One bar per asset a chain can
  source; length is log-scaled protocol-wide supplied liquidity. Each ring's group is
  nudged around the arc so groups read as a field, not as collinear rows.
- **Tracks**: real open intents. Cross-chain intents are two cubics meeting at the core;
  hub-local (Sonic→Sonic) intents are short loops off the core rather than dropped.
- **Composed route**: the trade form lights its own src→dst track, dashed while quoting
  and solid once the quote lands. The form and the diagram are one surface.
- Ring labels run up the beam axis, one row per ring, stroked against the ground.

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

- **Buttons** — primary is a yellow fill with vacuum ink; secondary is a hairline outline.
  A disabled button never carries a "connect wallet" label; that prompt is a hint beneath it.
- **Inputs** — vacuum fill, hairline border, ring-blue on focus-within.
- **Readouts** — label, dotted leader, right-aligned tabular value.
- **Tables** — sticky mono headers, hairline rows, right-aligned figures, hover on
  `--steel`, capped at 46vh inside a section so no row is ever half-cut.
- **Badges** — hairline outline plus semantic text, never a solid fill.
- **Icons** — authored SVG on a 16px grid at 1.25 stroke, drawn in the world's grammar
  (concentric arcs, crossing tracks, radial ticks). No unicode glyphs, no icon library.

## Never

Stat-card grids, centred swap cards, glassmorphism, glow halos, gradient text, rounded
cards, coloured left-border callouts, scanlines or CRT costume, purple/teal DeFi
gradients, emoji or unicode standing in for icons, a disabled button as a call to action.
