'use client';

import { useMemo, useState } from 'react';
import { useReservesUsdFormat, type ReserveUsdFormat } from '@sodax/dapp-kit';
import { isTokenAllowed } from '@/lib/config';
import { cleanSymbol, fmtPct, fmtUsd } from '@/lib/format';
import { MMSheet } from './MMSheet';
import { StakingPanel } from './StakingPanel';

export function EarnInstrument() {
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
    <>
      <div className="instr-head">
        <h1 className="instr-title">Earn</h1>
        <span className="badge badge-live">
          <span className="dot" />
          Live
        </span>
      </div>

      <div className="table-wrap">
        <table className="data">
          <caption className="sr-only">Money market reserves ranked by supply APY</caption>
          <thead>
            <tr>
              <th scope="col">Asset</th>
              <th scope="col" className="r">
                Supply
              </th>
              <th scope="col" className="r">
                Borrow
              </th>
              <th scope="col" className="r">
                Supplied
              </th>
              <th scope="col" className="r" aria-label="Actions" />
            </tr>
          </thead>
          <tbody>
            {isLoading && (
              <tr>
                <td colSpan={5} className="muted">
                  Loading reserves…
                </td>
              </tr>
            )}
            {markets.map(r => (
              <tr key={r.underlyingAsset}>
                <th scope="row" style={{ fontWeight: 400, textAlign: 'left' }}>
                  {cleanSymbol(r.symbol)}
                </th>
                <td className="r up">{fmtPct(r.supplyAPY)}</td>
                <td className="r">{fmtPct(r.variableBorrowAPY)}</td>
                <td className="r muted">
                  {fmtUsd(r.totalLiquidityUSD, { compact: true })}
                </td>
                <td className="r">
                  <button className="btn btn-row" onClick={() => setSelected(r)}>
                    Open
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="instr-section">
        <StakingPanel />
      </div>

      {selected && <MMSheet reserve={selected} onClose={() => setSelected(null)} />}
    </>
  );
}
