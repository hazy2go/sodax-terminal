/**
 * Authored icon set, drawn in the detector world's own grammar: concentric
 * arcs, curved tracks, radial ticks. One consistent 1.25px stroke on a 16px
 * grid. No unicode glyphs, no emoji, no third-party set.
 */

type P = { className?: string; size?: number };

function Svg({ children, size = 16, className }: P & { children: React.ReactNode }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.25}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
      className={className}
    >
      {children}
    </svg>
  );
}

/** Trade — two tracks crossing through the beamline. */
export function IconTrade(p: P) {
  return (
    <Svg {...p}>
      <path d="M1.6 3.4C5 3.4 6.4 8 8 8s3-4.6 6.4-4.6" />
      <path d="M1.6 12.6C5 12.6 6.4 8 8 8s3 4.6 6.4 4.6" />
      <circle cx="8" cy="8" r="1.35" />
    </Svg>
  );
}

/** Earn — calorimeter bars stacking outward from an arc. */
export function IconEarn(p: P) {
  return (
    <Svg {...p}>
      <path d="M2.6 13.4A7.4 7.4 0 0 1 2.6 2.6" />
      <path d="M5.6 4.4h3.2" />
      <path d="M5.6 8h6.8" />
      <path d="M5.6 11.6h4.8" />
    </Svg>
  );
}

/** Portfolio — your own track held on one ring. */
export function IconPortfolio(p: P) {
  return (
    <Svg {...p}>
      <circle cx="8" cy="8" r="6.1" />
      <circle cx="8" cy="8" r="2.5" />
      <circle cx="13.4" cy="5.4" r="1.15" fill="currentColor" stroke="none" />
    </Svg>
  );
}

/** Analytics — the full detector cross-section. */
export function IconAnalytics(p: P) {
  return (
    <Svg {...p}>
      <circle cx="8" cy="8" r="6.3" />
      <circle cx="8" cy="8" r="4" />
      <circle cx="8" cy="8" r="1.5" />
    </Svg>
  );
}

export function IconChevron(p: P) {
  return (
    <Svg {...p}>
      <path d="M4.5 6.5 8 10l3.5-3.5" />
    </Svg>
  );
}

export function IconClose(p: P) {
  return (
    <Svg {...p}>
      <path d="M4 4l8 8M12 4l-8 8" />
    </Svg>
  );
}

export function IconSearch(p: P) {
  return (
    <Svg {...p}>
      <circle cx="7.2" cy="7.2" r="4.4" />
      <path d="M10.6 10.6 13.6 13.6" />
    </Svg>
  );
}

export function IconWallet(p: P) {
  return (
    <Svg {...p}>
      <path d="M2.2 4.6h11.6v7.8H2.2z" />
      <path d="M2.2 4.6 10.4 2.6v2" />
      <circle cx="11" cy="8.5" r="0.9" fill="currentColor" stroke="none" />
    </Svg>
  );
}
