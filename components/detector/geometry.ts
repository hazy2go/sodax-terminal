/**
 * Detector geometry.
 *
 * The hub is the beamline at the centre. Each supported spoke chain owns an
 * angular SECTOR; within its sector, that chain's assets are radial bars whose
 * length encodes supplied liquidity against a shared log value axis. The
 * concentric rings are that axis — gridlines, not chain identity — which is
 * what lets a bar be long enough to compare at a glance.
 *
 * Everything is computed in a fixed user-space box and scaled by the SVG
 * viewBox, so the maths never depends on rendered pixel size.
 */

export const BOX_W = 1046;
export const BOX_H = 986;
export const CX = 523;
export const CY = 493;

export const CORE_R = 74;

/** Sonic is the beamline at the centre, not a sector. */
export const HUB = -1;

/** Radial value axis. */
/** The hub band sits between the core and the wedge axis: hub-local intents
 *  live here, and it needs real depth or they collapse into scribble. */
export const R_HUB_BAND = 78;
export const R_INNER = CORE_R + R_HUB_BAND;
export const R_OUTER = 392;

/**
 * The value axis is fitted to the data, not hard-coded. A fixed $10–$1M domain
 * saturated every wedge at full length, which made twenty different numbers
 * look identical.
 */
export type Axis = { lo: number; hi: number; ticks: number[] };

export function makeAxis(values: number[]): Axis {
  const positive = values.filter(v => Number.isFinite(v) && v > 0);
  if (positive.length === 0) return { lo: 1, hi: 10, ticks: [1, 10] };

  const max = Math.max(...positive);
  const min = Math.min(...positive);
  // round out to whole decades, and keep at least two so the scale reads
  const hi = Math.pow(10, Math.ceil(Math.log10(max)));
  const loRaw = Math.pow(10, Math.floor(Math.log10(min)));
  const lo = Math.min(loRaw, hi / 100);

  const ticks: number[] = [];
  for (let t = lo; t <= hi + 1e-9; t *= 10) ticks.push(t);
  return { lo, hi, ticks };
}

export function polar(r: number, deg: number): { x: number; y: number } {
  const rad = ((deg - 90) * Math.PI) / 180;
  return { x: CX + r * Math.cos(rad), y: CY + r * Math.sin(rad) };
}

/** Map a USD value onto the radial axis. */
export function valueRadius(v: number, axis: Axis): number {
  if (!Number.isFinite(v) || v <= 0) return R_INNER;
  const span = Math.log10(axis.hi) - Math.log10(axis.lo);
  if (span <= 0) return R_INNER;
  const t = (Math.log10(v) - Math.log10(axis.lo)) / span;
  return R_INNER + Math.max(0, Math.min(1, t)) * (R_OUTER - R_INNER);
}

/** The angular slice a chain owns, with a gutter so sectors read as separate. */
export function sector(i: number, count: number): { start: number; mid: number; end: number } {
  const width = 360 / count;
  const gutter = Math.min(3.4, width * 0.22);
  const start = i * width + gutter / 2;
  const end = (i + 1) * width - gutter / 2;
  return { start, mid: (start + end) / 2, end };
}

export function arcPath(r: number, startDeg: number, endDeg: number): string {
  const a = polar(r, startDeg);
  const b = polar(r, endDeg);
  const large = endDeg - startDeg > 180 ? 1 : 0;
  return `M ${a.x.toFixed(2)} ${a.y.toFixed(2)} A ${r} ${r} 0 ${large} 1 ${b.x.toFixed(2)} ${b.y.toFixed(2)}`;
}

/**
 * A route track: leaves its source sector at the axis edge, bends through the
 * beamline core, and terminates in its destination sector — so a track always
 * visibly connects two named chains.
 */
export function trackPath(srcDeg: number, dstDeg: number, srcR: number, dstR: number): string {
  const a = polar(srcR, srcDeg);
  const b = polar(dstR, dstDeg);
  const ca = polar(srcR * 0.36, srcDeg);
  const cb = polar(dstR * 0.36, dstDeg);
  return [
    `M ${a.x.toFixed(2)} ${a.y.toFixed(2)}`,
    `C ${ca.x.toFixed(2)} ${ca.y.toFixed(2)} ${CX} ${CY} ${CX} ${CY}`,
    `C ${CX} ${CY} ${cb.x.toFixed(2)} ${cb.y.toFixed(2)} ${b.x.toFixed(2)} ${b.y.toFixed(2)}`,
  ].join(' ');
}

/**
 * A hub-local intent — input and output both settle on Sonic, so it never
 * leaves the beamline. Drawn as a radial tick in the hub band rather than as a
 * looping curve: eighteen overlapping loops in a thin annulus read as scribble,
 * whereas ticks of differing length read as a bar chart of what is queued.
 */
export function hubTick(
  deg: number,
  reach = 1,
): { x1: number; y1: number; x2: number; y2: number } {
  const t = Math.max(0.12, Math.min(1, reach));
  const a = polar(CORE_R + 7, deg);
  const b = polar(CORE_R + 7 + (R_HUB_BAND - 18) * t, deg);
  return { x1: a.x, y1: a.y, x2: b.x, y2: b.y };
}

/** Stable pseudo-value from a hash, so a mark never jumps between renders. */
export function angleFromHash(hash: string, spread = 360, offset = 0): number {
  let h = 0;
  for (let i = 0; i < hash.length; i++) h = (h * 31 + hash.charCodeAt(i)) >>> 0;
  return offset + ((h % 10000) / 10000) * spread;
}
