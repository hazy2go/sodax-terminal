'use client';

import { useMemo } from 'react';
import { useReservesUsdFormat, useBackendOrderbook } from '@sodax/dapp-kit';
import { isTokenAllowed } from '@/lib/config';
import { cleanSymbol, fmtPct, fmtUsd } from '@/lib/format';
import { Separator } from '@/components/ui/separator';
import { ConnectChips } from './ConnectButton';

export function StatusStrip() {
  const { data: reserves } = useReservesUsdFormat();
  const { data: orderbook } = useBackendOrderbook({
    params: { pagination: { offset: '0', limit: '1' } },
  });

  const stats = useMemo(() => {
    const live = (reserves ?? []).filter(r => isTokenAllowed(cleanSymbol(r.symbol)));
    return {
      tvl: live.reduce((s, r) => s + Number(r.totalLiquidityUSD), 0),
      debt: live.reduce((s, r) => s + Number(r.totalDebtUSD), 0),
      best: live.reduce<(typeof live)[number] | undefined>(
        (b, r) => (Number(r.supplyAPY) > Number(b?.supplyAPY ?? -1) ? r : b),
        undefined,
      ),
      count: live.length,
    };
  }, [reserves]);

  return (
    <header className="flex h-full min-w-0 items-center gap-6 overflow-hidden border-b border-border bg-card pr-4">
      <div className="wordmark w-14 shrink-0 pl-4">SODAX</div>
      <Separator orientation="vertical" className="h-6" />

      <div className="flex min-w-0 items-center gap-6 overflow-hidden">
        <Stat label="Supplied" value={reserves ? fmtUsd(stats.tvl, { compact: true }) : '—'} />
        <Stat label="Borrowed" value={reserves ? fmtUsd(stats.debt, { compact: true }) : '—'} />
        <Stat label="Reserves" value={reserves ? String(stats.count) : '—'} className="max-md:hidden" />
        <Stat label="Open intents" value={orderbook ? String(orderbook.total) : '—'} className="max-md:hidden" />
        <Stat
          label="Top supply APY"
          accent
          className="max-sm:hidden"
          value={
            stats.best
              ? `${cleanSymbol(stats.best.symbol)} ${fmtPct(stats.best.supplyAPY)}`
              : '—'
          }
        />
      </div>

      <div className="ml-auto flex shrink-0 items-center gap-2">
        <ConnectChips />
      </div>
    </header>
  );
}

function Stat({
  label,
  value,
  accent,
  className,
}: {
  label: string;
  value: string;
  accent?: boolean;
  className?: string;
}) {
  return (
    <div className={`flex flex-col leading-tight ${className ?? ''}`}>
      <span className="label-micro">{label}</span>
      <span className={`fig text-[13px] ${accent ? 'text-primary' : 'text-foreground'}`}>
        {value}
      </span>
    </div>
  );
}
