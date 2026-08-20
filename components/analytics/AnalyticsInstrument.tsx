'use client';

import { useCallback, useMemo } from 'react';
import { useReservesUsdFormat, useBackendOrderbook, useSodaxContext } from '@sodax/dapp-kit';
import { isTokenAllowed, relayChainName } from '@/lib/config';
import { fmtUsd, fmtPct, fmtAmount, cleanSymbol, fmtDeadline } from '@/lib/format';

export function AnalyticsInstrument() {
  const { sodax } = useSodaxContext();
  const { data: reserves, isLoading: reservesLoading } = useReservesUsdFormat();
  const { data: orderbook, isLoading: orderbookLoading } = useBackendOrderbook({
    params: { pagination: { offset: '0', limit: '16' } },
  });

  const markets = useMemo(() => {
    if (!reserves) return [];
    return reserves
      .filter(r => isTokenAllowed(cleanSymbol(r.symbol)))
      .slice()
      .sort((a, b) => Number(b.totalLiquidityUSD) - Number(a.totalLiquidityUSD));
  }, [reserves]);

  const reserveIndex = useMemo(() => {
    const m = new Map<string, { symbol: string; decimals: number }>();
    for (const r of reserves ?? []) {
      m.set(r.underlyingAsset.toLowerCase(), {
        symbol: cleanSymbol(r.symbol),
        decimals: r.decimals,
      });
    }
    return m;
  }, [reserves]);

  /**
   * Intents reference hub asset addresses. Resolve through the SDK's hub-asset
   * registry first, then the reserves. Null means unidentified — the row is
   * then hidden, because an unresolved token can't be cleared by the denylist.
   */
  const resolveToken = useCallback(
    (address: string) => {
      const hubToken = sodax.config.getXTokenFromHubAsset(address);
      if (hubToken) {
        return { symbol: cleanSymbol(hubToken.symbol), decimals: hubToken.decimals };
      }
      return reserveIndex.get(address.toLowerCase()) ?? null;
    },
    [sodax, reserveIndex],
  );

  return (
    <>
      <div className="instr-head">
        <h1 className="instr-title">Analytics</h1>
        <span className="badge badge-live">
          <span className="dot" />
          Live
        </span>
      </div>

      <div className="instr-section">
        <div className="instr-head">
          <h2 className="instr-title">Reserves</h2>
          <span className="badge badge-neutral">{markets.length}</span>
        </div>
        <div className="table-wrap">
          <table className="data">
            <thead>
              <tr>
                <th scope="col">Asset</th>
                <th scope="col" className="r">
                  Price
                </th>
                <th scope="col" className="r">
                  Supplied
                </th>
                <th scope="col" className="r">
                  Supply
                </th>
                <th scope="col" className="r">
                  Util
                </th>
              </tr>
            </thead>
            <tbody>
              {reservesLoading && (
                <tr>
                  <td colSpan={5} className="muted">
                    Loading reserves…
                  </td>
                </tr>
              )}
              {markets.map(r => {
                const util = Math.min(1, Math.max(0, Number(r.borrowUsageRatio)));
                return (
                  <tr key={r.underlyingAsset}>
                    <th scope="row" style={{ fontWeight: 400, textAlign: 'left' }}>
                      {cleanSymbol(r.symbol)}
                    </th>
                    <td className="r">{fmtUsd(r.priceInUSD)}</td>
                    <td className="r">{fmtUsd(r.totalLiquidityUSD, { compact: true })}</td>
                    <td className="r up">{fmtPct(r.supplyAPY)}</td>
                    <td className="r">
                      <span className="gauge">
                        <span className="gauge-bar">
                          <span
                            className="gauge-fill"
                            style={{ width: `${(util * 100).toFixed(0)}%` }}
                          />
                        </span>
                        <span className="muted">{fmtPct(r.borrowUsageRatio, 0)}</span>
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      <div className="instr-section">
        <div className="instr-head">
          <h2 className="instr-title">Open intents</h2>
          <span className="badge badge-neutral">{orderbook?.total ?? '—'}</span>
        </div>
        <div className="table-wrap">
          <table className="data">
            <thead>
              <tr>
                <th scope="col">Pair</th>
                <th scope="col" className="r">
                  Remaining
                </th>
                <th scope="col" className="r">
                  Route
                </th>
                <th scope="col" className="r">
                  Expiry
                </th>
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
                const input = resolveToken(o.intentData.inputToken);
                const output = resolveToken(o.intentData.outputToken);
                // Fail closed: an unidentified token can't clear the denylist.
                if (!input || !output) return null;
                if (!isTokenAllowed(input.symbol) || !isTokenAllowed(output.symbol)) {
                  return null;
                }
                return (
                  <tr key={o.intentData.intentHash}>
                    <td>
                      {input.symbol}
                      <span className="muted"> → </span>
                      {output.symbol}
                    </td>
                    <td className="r">
                      {fmtAmount(o.intentState.remainingInput, input.decimals)}
                    </td>
                    <td className="r muted">
                      {relayChainName(sodax.config, o.intentData.srcChain)}
                      {o.intentData.srcChain !== o.intentData.dstChain &&
                        ` → ${relayChainName(sodax.config, o.intentData.dstChain)}`}
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
      </div>

      <p className="note" style={{ padding: 14 }}>
        Swaps are intent-based and routed by competing solvers. Every figure here is live
        protocol data.
      </p>
    </>
  );
}
