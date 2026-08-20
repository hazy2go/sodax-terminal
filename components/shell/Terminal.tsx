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
import { ScrollArea } from '@/components/ui/scroll-area';

export function Terminal() {
  const [instrument, setInstrument] = useState<Instrument>('Trade');

  return (
    <FocusProvider>
      <div className="grid h-dvh w-full grid-cols-[56px_minmax(0,1fr)_400px] grid-rows-[46px_minmax(0,1fr)_30px] overflow-hidden max-lg:grid-cols-[56px_minmax(0,1fr)] max-lg:grid-rows-[46px_44vh_auto_30px] max-lg:h-auto max-lg:min-h-dvh">
        <div className="col-span-full">
          <StatusStrip />
        </div>

        <div className="row-span-1 max-lg:row-span-2">
          <InstrumentRail active={instrument} onSelect={setInstrument} />
        </div>

        <div className="min-h-0 min-w-0">
          <Detector />
        </div>

        <aside
          aria-label={`${instrument} instrument`}
          className="min-h-0 min-w-0 border-l border-border bg-card max-lg:border-l-0 max-lg:border-t"
        >
          <ScrollArea className="h-full max-lg:h-auto">
            {instrument === 'Trade' && <TradeInstrument />}
            {instrument === 'Earn' && <EarnInstrument />}
            {instrument === 'Portfolio' && <PortfolioInstrument />}
            {instrument === 'Analytics' && <AnalyticsInstrument />}
          </ScrollArea>
        </aside>

        <div className="col-span-full">
          <FillsTape />
        </div>
      </div>
    </FocusProvider>
  );
}
