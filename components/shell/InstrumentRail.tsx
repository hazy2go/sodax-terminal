'use client';

import { IconTrade, IconEarn, IconPortfolio, IconAnalytics } from '@/components/icons';

export const INSTRUMENTS = ['Trade', 'Earn', 'Portfolio', 'Analytics'] as const;
export type Instrument = (typeof INSTRUMENTS)[number];

const GLYPH = {
  Trade: IconTrade,
  Earn: IconEarn,
  Portfolio: IconPortfolio,
  Analytics: IconAnalytics,
} as const;

export function InstrumentRail({
  active,
  onSelect,
}: {
  active: Instrument;
  onSelect: (i: Instrument) => void;
}) {
  return (
    <nav className="rail" role="tablist" aria-label="Instruments" aria-orientation="vertical">
      {INSTRUMENTS.map(name => {
        const Glyph = GLYPH[name];
        return (
          <button
            key={name}
            role="tab"
            aria-selected={active === name}
            className="rail-btn"
            onClick={() => onSelect(name)}
          >
            <Glyph size={18} />
            <span className="rail-tip">{name}</span>
            <span className="sr-only">{name}</span>
          </button>
        );
      })}
    </nav>
  );
}
