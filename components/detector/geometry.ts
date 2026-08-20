/**
 * Detector geometry. The hub is the beamline at the centre; each spoke chain
 * is a concentric ring outward. Everything is computed in a fixed 1000x1000
 * user-space box and scaled by the SVG viewBox, so the maths never depends on
 * the rendered pixel size.
 */

export const BOX_W = 1180;
export const BOX_H = 1000;
export const CX = 520;
export const CY = 500;

/** Sonic is the beamline at the centre, not a ring. */
export const HUB = -1;

export const CORE_R = 52;
const FIRST_R = 84;
const RING_GAP = 18.5;

export function ringRadius(index: number): number {
  if (index < 0) return CORE_R + 9;
  return FIRST_R + index * RING_GAP;
}

export function outerRadius(ringCount: number): number {
  return ringRadius(Math.max(0, ringCount - 1));
}

export function polar(r: number, deg: number): { x: number; y: number } {
  const rad = ((deg - 90) * Math.PI) / 180;
  return { x: CX + r * Math.cos(rad), y: CY + r * Math.sin(rad) };
}

/**
 * A route track: leaves the source chain's ring, bends through the beamline
 * core, and terminates on the destination chain's ring. Two cubic segments
 * meeting at the core, so the curve reads as one continuous pass rather than
 * as a spoke radiating symmetrically outward.
 */
export function trackPath(
  srcRing: number,
  srcDeg: number,
  dstRing: number,
  dstDeg: number,
): string {
  const a = polar(ringRadius(srcRing), srcDeg);
  const b = polar(ringRadius(dstRing), dstDeg);

  // control points pulled toward the core, offset tangentially so the two
  // halves sweep rather than fold back on themselves
  const ca = polar(ringRadius(srcRing) * 0.34, srcDeg + 16);
  const cb = polar(ringRadius(dstRing) * 0.34, dstDeg - 16);
  const core = polar(CORE_R * 0.9, (srcDeg + dstDeg) / 2);

  return [
    `M ${a.x.toFixed(2)} ${a.y.toFixed(2)}`,
    `C ${ca.x.toFixed(2)} ${ca.y.toFixed(2)} ${core.x.toFixed(2)} ${core.y.toFixed(2)} ${CX} ${CY}`,
    `C ${core.x.toFixed(2)} ${core.y.toFixed(2)} ${cb.x.toFixed(2)} ${cb.y.toFixed(2)} ${b.x.toFixed(2)} ${b.y.toFixed(2)}`,
  ].join(' ');
}

/** Stable pseudo-angle from a hash string, so a track never jumps between renders. */
export function angleFromHash(hash: string, spread = 360, offset = 0): number {
  let h = 0;
  for (let i = 0; i < hash.length; i++) {
    h = (h * 31 + hash.charCodeAt(i)) >>> 0;
  }
  return offset + (h % 10000) / 10000 * spread;
}

/**
 * A calorimeter bar: a short radial rectangle sitting just outside its ring,
 * drawn as a rotated rect so the whole set reads as a circular bar chart.
 */
export function caloBar(
  ring: number,
  deg: number,
  length: number,
  width = 3.1,
): { x: number; y: number; w: number; h: number; deg: number } {
  const r = ringRadius(ring) + 4;
  return { x: r, y: -width / 2, w: Math.max(2, length), h: width, deg };
}

/** Log scale — protocol liquidity spans several orders of magnitude. */
export function logScale(value: number, max: number, maxLen: number): number {
  if (!Number.isFinite(value) || value <= 0 || max <= 0) return 0;
  const t = Math.log10(1 + value) / Math.log10(1 + max);
  return Math.max(2, t * maxLen);
}

/**
 * A hub-local intent: input and output both settle on Sonic, so it never
 * leaves the beamline. Drawn as a short loop off the core rather than
 * silently dropped — these are a real and large share of the orderbook.
 */
export function hubLoopPath(deg: number): string {
  const a = polar(CORE_R + 3, deg - 5);
  const b = polar(CORE_R + 3, deg + 5);
  const out = polar(CORE_R + 74, deg);
  return [
    `M ${a.x.toFixed(2)} ${a.y.toFixed(2)}`,
    `Q ${out.x.toFixed(2)} ${out.y.toFixed(2)} ${b.x.toFixed(2)} ${b.y.toFixed(2)}`,
  ].join(' ');
}
