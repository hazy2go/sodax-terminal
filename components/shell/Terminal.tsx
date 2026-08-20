'use client';

import { useState } from 'react';
import { StatusStrip } from './StatusStrip';
import { InstrumentRail, type Instrument } from './InstrumentRail';
import { FillsTape } from './FillsTape';
import { Detector } from '@/components/detector/Detector';
import { FocusProvider } from '@/components/detector/focus';
import { TradeInstrument } from '@/components/trade/TradeInstrument';
import { EarnInstrument } from '@/components/earn/EarnInstrument';
import { PortfolioInstrument } from '@/components/portfolio/PortfolioInstrument';
import { AnalyticsInstrument } from '@/components/analytics/AnalyticsInstrument';

export function Terminal() {
  const [instrument, setInstrument] = useState<Instrument>('Trade');

  return (
    <FocusProvider>
      <div className="shell">
        <StatusStrip />
        <InstrumentRail active={instrument} onSelect={setInstrument} />
        <Detector />
        <aside className="instr" aria-label={`${instrument} instrument`}>
          {instrument === 'Trade' && <TradeInstrument />}
          {instrument === 'Earn' && <EarnInstrument />}
          {instrument === 'Portfolio' && <PortfolioInstrument />}
          {instrument === 'Analytics' && <AnalyticsInstrument />}
        </aside>
        <FillsTape />
      </div>
    </FocusProvider>
  );
}
