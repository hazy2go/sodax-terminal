'use client';

import { useMemo } from 'react';
import { useReservesUsdFormat, useBackendOrderbook } from '@sodax/dapp-kit';
import { isTokenAllowed } from '@/lib/config';
import { cleanSymbol, fmtPct, fmtUsd } from '@/lib/format';
import { ConnectChips } from './ConnectButton';

export function StatusStrip() {
  const { data: reserves } = useReservesUsdFormat();
  const { data: orderbook } = useBackendOrderbook({
    params: { pagination: { offset: '0', limit: '1' } },
  });

  const stats = useMemo(() => {
    const live = (reserves ?? []).filter(r => isTokenAllowed(cleanSymbol(r.symbol)));
    const tvl = live.reduce((s, r) => s + Number(r.totalLiquidityUSD), 0);
    const debt = live.reduce((s, r) => s + Number(r.totalDebtUSD), 0);
    const best = live.reduce<(typeof live)[number] | undefined>(
      (b, r) => (Number(r.supplyAPY) > Number(b?.supplyAPY ?? -1) ? r : b),
      undefined,
    );
    return { tvl, debt, best, count: live.length };
  }, [reserves]);

  return (
    <header className="strip">
      <div className="wordmark">SODAX</div>

      <div className="strip-stats">
        <Stat label="Supplied" value={reserves ? fmtUsd(stats.tvl, { compact: true }) : '—'} />
        <Stat label="Borrowed" value={reserves ? fmtUsd(stats.debt, { compact: true }) : '—'} />
        <Stat label="Reserves" value={reserves ? String(stats.count) : '—'} />
        <Stat
          label="Open intents"
          value={orderbook ? String(orderbook.total) : '—'}
        />
        <Stat
          label="Top supply APY"
          hot
          value={
            stats.best
              ? `${cleanSymbol(stats.best.symbol)} ${fmtPct(stats.best.supplyAPY)}`
              : '—'
          }
        />
      </div>

      <div className="strip-right">
        <ConnectChips />
      </div>
    </header>
  );
}

function Stat({ label, value, hot }: { label: string; value: string; hot?: boolean }) {
  return (
    <div className="stat">
      <span className="label">{label}</span>
      <span className={`stat-val${hot ? ' hot' : ''}`}>{value}</span>
    </div>
  );
}
