'use client';

import { useMemo, useState } from 'react';
import { useReservesUsdFormat, type ReserveUsdFormat } from '@sodax/dapp-kit';
import { isTokenAllowed } from '@/lib/config';
import { cleanSymbol, fmtPct, fmtUsd } from '@/lib/format';
import { MMModal } from './MMModal';
import { StakingPanel } from './StakingPanel';

export function EarnTab() {
  const { data: reserves, isLoading } = useReservesUsdFormat();
  const [selected, setSelected] = useState<ReserveUsdFormat | null>(null);

  const markets = useMemo(() => {
    if (!reserves) return [];
    return reserves
      .filter(r => isTokenAllowed(cleanSymbol(r.symbol)))
      .slice()
      .sort((a, b) => Number(b.supplyAPY) - Number(a.supplyAPY));
  }, [reserves]);

  return (
    <div className="earn-grid">
      <section className="panel">
        <div className="panel-head">
          <h2 className="panel-title">Yield — Ranked by Supply APY</h2>
          <span className="badge badge-neutral">live · 5s</span>
        </div>
        <div className="table-scroll">
          <table className="data">
            <thead>
              <tr>
                <th>Asset</th>
                <th className="r">Supply APY</th>
                <th className="r">Borrow APY</th>
                <th className="r">Supplied</th>
                <th className="r">Available</th>
                <th className="r" aria-label="Actions" />
              </tr>
            </thead>
            <tbody>
              {isLoading && (
                <tr>
                  <td colSpan={6} className="muted">
                    Loading reserves…
                  </td>
                </tr>
              )}
              {markets.map(r => (
                <tr key={r.underlyingAsset}>
                  <td>
                    <strong>{cleanSymbol(r.symbol)}</strong>
                  </td>
                  <td className="r up">{fmtPct(r.supplyAPY)}</td>
                  <td className="r">{fmtPct(r.variableBorrowAPY)}</td>
                  <td className="r">{fmtUsd(r.totalLiquidityUSD, { compact: true })}</td>
                  <td className="r muted">
                    {fmtUsd(r.availableLiquidityUSD, { compact: true })}
                  </td>
                  <td className="r">
                    <button className="btn row-btn" onClick={() => setSelected(r)}>
                      Supply / Borrow
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <StakingPanel />

      {selected && <MMModal reserve={selected} onClose={() => setSelected(null)} />}
    </div>
  );
}
