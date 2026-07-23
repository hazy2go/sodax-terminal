'use client';

import { useMemo } from 'react';
import { useReservesUsdFormat, useBackendOrderbook } from '@sodax/dapp-kit';
import { isTokenAllowed } from '@/lib/config';
import {
  fmtUsd,
  fmtPct,
  fmtAmount,
  shortAddr,
  cleanSymbol,
  fmtDeadline,
  intentChainName,
} from '@/lib/format';

/** address (lowercase) → reserve lookup for resolving orderbook token symbols */
type ReserveIndex = Map<string, { symbol: string; decimals: number; priceInUSD: string }>;

export function AnalyticsTab() {
  const { data: reserves, isLoading: reservesLoading } = useReservesUsdFormat();
  const { data: orderbook, isLoading: orderbookLoading } = useBackendOrderbook({
    params: { pagination: { offset: '0', limit: '14' } },
  });

  const markets = useMemo(() => {
    if (!reserves) return [];
    return reserves
      .filter(r => isTokenAllowed(cleanSymbol(r.symbol)))
      .slice()
      .sort((a, b) => Number(b.totalLiquidityUSD) - Number(a.totalLiquidityUSD));
  }, [reserves]);

  const totals = useMemo(() => {
    const tvl = markets.reduce((s, r) => s + Number(r.totalLiquidityUSD), 0);
    const debt = markets.reduce((s, r) => s + Number(r.totalDebtUSD), 0);
    const bestSupply = markets.reduce(
      (best, r) => (Number(r.supplyAPY) > Number(best?.supplyAPY ?? 0) ? r : best),
      markets[0],
    );
    return { tvl, debt, bestSupply };
  }, [markets]);

  const reserveIndex: ReserveIndex = useMemo(() => {
    const m: ReserveIndex = new Map();
    for (const r of reserves ?? []) {
      m.set(r.underlyingAsset.toLowerCase(), {
        symbol: cleanSymbol(r.symbol),
        decimals: r.decimals,
        priceInUSD: r.priceInUSD,
      });
    }
    return m;
  }, [reserves]);

  return (
    <div className="stack">
      {/* market summary strip */}
      <div className="statbar mono">
        <span>
          <span className="statbar-label">TVL</span>{' '}
          {reservesLoading ? '…' : fmtUsd(totals.tvl, { compact: true })}
        </span>
        <span>
          <span className="statbar-label">BORROWED</span>{' '}
          {reservesLoading ? '…' : fmtUsd(totals.debt, { compact: true })}
        </span>
        <span>
          <span className="statbar-label">RESERVES</span>{' '}
          {reservesLoading ? '…' : markets.length}
        </span>
        <span>
          <span className="statbar-label">OPEN INTENTS</span>{' '}
          {orderbookLoading ? '…' : orderbook?.total ?? '—'}
        </span>
        {totals.bestSupply && (
          <span>
            <span className="statbar-label">TOP APY</span>{' '}
            <span className="up">
              {cleanSymbol(totals.bestSupply.symbol)} {fmtPct(totals.bestSupply.supplyAPY)}
            </span>
          </span>
        )}
      </div>

      <div className="analytics-grid">
        {/* money market reserves */}
        <section className="panel">
          <div className="panel-head">
            <h2 className="panel-title">Money Market — All Reserves</h2>
            <span className="badge badge-neutral">live · 5s</span>
          </div>
          <div className="table-scroll">
            <table className="data">
              <thead>
                <tr>
                  <th>Asset</th>
                  <th className="r">Price</th>
                  <th className="r">Supplied</th>
                  <th className="r">Borrowed</th>
                  <th className="r">Supply APY</th>
                  <th className="r">Borrow APY</th>
                  <th className="r">Util</th>
                </tr>
              </thead>
              <tbody>
                {reservesLoading && (
                  <tr>
                    <td colSpan={7} className="muted">
                      Loading reserves…
                    </td>
                  </tr>
                )}
                {markets.map(r => (
                  <tr key={r.underlyingAsset}>
                    <td>
                      <strong>{cleanSymbol(r.symbol)}</strong>
                    </td>
                    <td className="r">{fmtUsd(r.priceInUSD)}</td>
                    <td className="r">{fmtUsd(r.totalLiquidityUSD, { compact: true })}</td>
                    <td className="r">{fmtUsd(r.totalDebtUSD, { compact: true })}</td>
                    <td className="r up">{fmtPct(r.supplyAPY)}</td>
                    <td className="r">{fmtPct(r.variableBorrowAPY)}</td>
                    <td className="r muted">{fmtPct(r.borrowUsageRatio, 0)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        {/* live orderbook */}
        <section className="panel">
          <div className="panel-head">
            <h2 className="panel-title">Open Intents</h2>
            <span className="badge badge-neutral">
              {orderbook ? `${orderbook.total} open` : '…'}
            </span>
          </div>
          <div className="table-scroll">
            <table className="data">
              <thead>
                <tr>
                  <th>Pair</th>
                  <th className="r">Remaining</th>
                  <th className="r">Route</th>
                  <th className="r">Expiry</th>
                </tr>
              </thead>
              <tbody>
                {orderbookLoading && (
                  <tr>
                    <td colSpan={4} className="muted">
                      Loading intents…
                    </td>
                  </tr>
                )}
                {orderbook?.data.map(o => {
                  const input = reserveIndex.get(o.intentData.inputToken.toLowerCase());
                  const output = reserveIndex.get(o.intentData.outputToken.toLowerCase());
                  const inSym = input?.symbol ?? shortAddr(o.intentData.inputToken);
                  const outSym = output?.symbol ?? shortAddr(o.intentData.outputToken);
                  if (!isTokenAllowed(inSym) || !isTokenAllowed(outSym)) return null;
                  return (
                    <tr key={o.intentData.intentHash}>
                      <td className="mono">
                        {inSym}
                        <span className="muted">→</span>
                        {outSym}
                      </td>
                      <td className="r">
                        {input
                          ? fmtAmount(o.intentState.remainingInput, input.decimals)
                          : '—'}
                      </td>
                      <td className="r muted">
                        {intentChainName(o.intentData.srcChain)}
                        {o.intentData.srcChain !== o.intentData.dstChain &&
                          `→${intentChainName(o.intentData.dstChain)}`}
                      </td>
                      <td className="r muted">
                        {fmtDeadline(o.intentData.deadline, Date.now())}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>
      </div>

      <p className="footnote">
        Swaps are intent-based and routed by solvers. Rates refresh live from the money
        market.
      </p>
    </div>
  );
}
