'use client';

import { useState } from 'react';
import { ConnectButton } from './ConnectButton';

const TABS = ['Trade', 'Earn', 'Portfolio', 'Analytics'] as const;
export type TabName = (typeof TABS)[number];

export function Terminal() {
  const [tab, setTab] = useState<TabName>('Trade');

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
        {tab === 'Trade' && <div className="placeholder">TRADE — coming in Phase 5</div>}
        {tab === 'Earn' && <div className="placeholder">EARN — coming in Phase 6</div>}
        {tab === 'Portfolio' && <div className="placeholder">PORTFOLIO — coming in Phase 7</div>}
        {tab === 'Analytics' && <div className="placeholder">ANALYTICS — coming in Phase 4</div>}
      </main>
    </div>
  );
}
