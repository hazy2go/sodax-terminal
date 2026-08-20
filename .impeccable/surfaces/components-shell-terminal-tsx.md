---
version: 1
slug: "components-shell-terminal-tsx"
primary_target: "components/shell/Terminal.tsx"
related_targets: ["app/globals.css","app/layout.tsx","components/analytics/AnalyticsTab.tsx","components/trade/TradeTab.tsx","components/earn/EarnTab.tsx","components/portfolio/PortfolioTab.tsx"]
---

## Scope & mode

The SODAX Terminal application shell and all four working surfaces (Trade, Earn, Portfolio, Analytics). Visitor mode: **Operate** — the visitor completes a task (trade, lend, stake, review a position). Expression may never obscure the task, state, or a familiar affordance.

## Audience & job

Crypto-native traders and DeFi power users on a laptop, dark room or office, judging in seconds whether this is a serious tool. Secondary: builders evaluating whether one SDK covers real product surface area. The job: read live market state, then act on it with a signature — with fees, slippage and health factor visible before signing.

## Chosen direction

**Event Display** (seed key `8ff96446`, roll assigned index 7, mode Operate). Lineage: collider detector event displays. The product's hub-and-spoke architecture is rendered as a detector cross-section: Sonic is the beamline core, the twelve spoke chains are concentric rings, and every live intent is a track arcing source-ring → hub → destination-ring. Competing solver quotes render as ghost tracks with confidence as line weight — the source's native grammar, mapped to the one thing SODAX does that nobody else does.

Approved comp: `.impeccable/mocks/comp-a-canvas.png` (spine), grafted with the per-ring calorimeter treatment from `.impeccable/mocks/comp-c-radial.png`.

## Memorable moment

The event bloom: on load and on every new intent, tracks curl outward from the beamline through the rings while calorimeter bars stack. Driven by real orderbook data, orchestrated with anime.js timelines.

## Comp corrections — must not be literalized

1. Comp A's tracks radiate symmetrically like a flower. **Wrong.** Each track is a real route: it must leave its source chain's ring, pass through the hub core, and terminate on its destination ring.
2. Comp A's rings read as a wireframe globe. They must read as a **flat cross-section**.
3. Comp C's callout blocks carry unlabelled number triplets. Every callout carries a label and a unit.
4. Every figure in both comps is **synthetic demonstration data**. The build wires real SDK values throughout.

## Implementation fidelity inventory

| Ingredient | Comp evidence | Medium |
|---|---|---|
| Detector rings (12 chains + hub core) | precise concentric geometry, interactive | authored SVG |
| Intent tracks, src→hub→dst | animated, data-driven, 20–40 live | SVG paths + anime.js |
| Ghost tracks (competing solver quotes) | line weight = confidence | SVG paths + anime.js |
| Calorimeter bars per ring segment | radial bar chart, bar length = supplied | SVG rects, radial transform |
| Leader-line callouts on hover | line geometry + text block | SVG line + HTML |
| Status bar, stat groups | text + layout | semantic HTML/CSS |
| Left icon rail glyphs | flat countable shape system | authored inline SVG, world grammar |
| Swap form, MM modal, staking panel | controls | semantic HTML/CSS |
| Tables + utilisation hairline gauges | dense data | semantic HTML/CSS |
| Token + chain logos | real brand marks | existing SDK asset CDN (`TOKEN_LOGO_BASE_URL`, `chainLogo`) |
| Fills tape (time-and-sales) | streaming text | HTML/CSS + anime.js |
| Health factor gauge | flat geometry, non-colour-redundant | SVG/CSS |

## Constraints

- All eight audit fixes from the previous session must survive the rebuild: relay-chain naming, health-factor `-1` sentinel, market-swap deadline, cancel provider selection, closed-not-filled history labels, fail-closed denylist, hub-wallet intent lookup, and the non-CTA wallet hint.
- `prefers-reduced-motion`: the bloom becomes an instant state; no ambient motion.
- Colour is never the sole carrier — deltas signed, statuses labelled.
- WCAG AA (4.5:1) body contrast on the dark ground.

## Unresolved

- Display face for the wordmark and panel titles (the reference board used Orbitron; a wide technical grotesk without sci-fi costume is preferred). Geist Sans/Mono stay as UI and data faces.
- Whether track rendering stays SVG or moves to canvas at full intent density — decide against measured perf, not upfront.
