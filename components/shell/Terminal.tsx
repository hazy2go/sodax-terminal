'use client';

import { useState } from 'react';
import { ConnectButton } from './ConnectButton';
import { AnalyticsTab } from '@/components/analytics/AnalyticsTab';
import { TradeTab } from '@/components/trade/TradeTab';
import { EarnTab } from '@/components/earn/EarnTab';

const TABS = ['Trade', 'Earn', 'Portfolio', 'Analytics'] as const;
export type TabName = (typeof TABS)[number];

export function Terminal() {
  // Analytics is the default landing tab until Trade ships — live data, no wallet needed.
  const [tab, setTab] = useState<TabName>('Analytics');

  return (
    <div className="shell">
      <header className="topbar">
        <div className="brand">
          <span>
            <span className="brand-mark">SODAX</span> TERMINAL
          </span>
          <span className="brand-sub">CROSS-CHAIN DESK</span>
        </div>
        <ConnectButton />
      </header>

      <nav className="tabrail" role="tablist" aria-label="Terminal sections">
        {TABS.map(t => (
          <button
            key={t}
            role="tab"
            className="tab"
            aria-selected={tab === t}
            onClick={() => setTab(t)}
          >
            {t}
          </button>
        ))}
      </nav>

      <main className="content">
        {tab === 'Trade' && <TradeTab />}
        {tab === 'Earn' && <EarnTab />}
        {tab === 'Portfolio' && <div className="placeholder">PORTFOLIO — coming in Phase 7</div>}
        {tab === 'Analytics' && <AnalyticsTab />}
      </main>
    </div>
  );
}
