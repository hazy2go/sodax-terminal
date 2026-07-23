'use client';

import { useMemo, useState } from 'react';
import {
  useSodaxContext,
  useXBalances,
  useReservesUsdFormat,
  useUserFormattedSummary,
  useBackendUserIntents,
  useCancelSwap,
} from '@sodax/dapp-kit';
import {
  useWalletProvider,
  useXAccount,
  useXService,
} from '@sodax/wallet-sdk-react';
import { ChainKeys } from '@sodax/types';
import type { SpokeChainKey, XToken, Address, Hex } from '@sodax/types';
import type { Intent, IntentResponse } from '@sodax/sdk';
import { formatUnits } from 'viem';
import { chainName, isTokenAllowed } from '@/lib/config';
import { TRADE_CHAINS, chainTypeOf } from '@/lib/tokens';
import { cleanSymbol, fmtUsd, shortAddr } from '@/lib/format';

/* ---------- balances ---------- */

function useSymbolPrices(): Map<string, number> {
  const { data: reserves } = useReservesUsdFormat();
  return useMemo(() => {
    const m = new Map<string, number>();
    for (const r of reserves ?? []) {
      m.set(cleanSymbol(r.symbol).toUpperCase(), Number(r.priceInUSD));
    }
    return m;
  }, [reserves]);
}

function ChainBalances({
  chainKey,
  prices,
}: {
  chainKey: SpokeChainKey;
  prices: Map<string, number>;
}) {
  const { sodax } = useSodaxContext();
  const account = useXAccount({ xChainType: chainTypeOf(chainKey) });
  const xService = useXService({ xChainType: chainTypeOf(chainKey) });

  const xTokens: readonly XToken[] = useMemo(
    () => sodax.config.getSupportedSwapTokensByChainId(chainKey).filter(t => isTokenAllowed(t.symbol)),
    [sodax, chainKey],
  );

  const { data: balances } = useXBalances({
    params: { xService, xChainId: chainKey, xTokens, address: account.address },
  });

  const rows = useMemo(() => {
    if (!balances) return [];
    return xTokens
      .map(t => {
        const raw = balances[t.address] ?? 0n;
        const amount = Number(formatUnits(raw, t.decimals));
        const price = prices.get(t.symbol.toUpperCase());
        return { token: t, amount, usd: price !== undefined ? amount * price : null };
      })
      .filter(r => r.amount > 0)
      .sort((a, b) => (b.usd ?? 0) - (a.usd ?? 0));
  }, [balances, xTokens, prices]);

  if (!account.address || rows.length === 0) return null;

  return (
    <>
      {rows.map(r => (
        <tr key={`${r.token.address}-${chainKey}`}>
          <td>
            <strong>{r.token.symbol}</strong>
          </td>
          <td className="muted">{chainName(chainKey)}</td>
          <td className="r">
            {r.amount.toLocaleString('en-US', { maximumFractionDigits: 5 })}
          </td>
          <td className="r">{r.usd !== null ? fmtUsd(r.usd, { compact: true }) : '—'}</td>
        </tr>
      ))}
    </>
  );
}

/* ---------- orders ---------- */

function toIntent(res: IntentResponse): Intent {
  const i = res.intent;
  return {
    intentId: BigInt(i.intentId),
    creator: i.creator as Address,
    inputToken: i.inputToken as Address,
    outputToken: i.outputToken as Address,
    inputAmount: BigInt(i.inputAmount),
    minOutputAmount: BigInt(i.minOutputAmount),
    deadline: BigInt(i.deadline),
    allowPartialFill: i.allowPartialFill,
    srcChain: BigInt(i.srcChain) as Intent['srcChain'],
    dstChain: BigInt(i.dstChain) as Intent['dstChain'],
    srcAddress: i.srcAddress as Hex,
    dstAddress: i.dstAddress as Hex,
    solver: i.solver as Address,
    data: i.data as Hex,
  };
}

/* ---------- tab ---------- */

export function PortfolioTab() {
  const { sodax } = useSodaxContext();
  const evmAccount = useXAccount({ xChainType: 'EVM' });
  const solAccount = useXAccount({ xChainType: 'SOLANA' });
  const evmProvider = useWalletProvider({ xChainType: 'EVM' });
  const prices = useSymbolPrices();
  const [error, setError] = useState<string | null>(null);

  const { data: summary } = useUserFormattedSummary({
    params: {
      spokeChainKey: ChainKeys.SONIC_MAINNET,
      userAddress: evmAccount.address,
    },
  });

  const { data: intents } = useBackendUserIntents({
    params: { userAddress: evmAccount.address as Address | undefined },
  });

  const { mutateAsyncSafe: cancelSwap, isPending: isCancelling } = useCancelSwap();

  const open = useMemo(
    () => (intents?.items ?? []).filter(i => i.open),
    [intents],
  );
  const history = useMemo(
    () => (intents?.items ?? []).filter(i => !i.open).slice(0, 10),
    [intents],
  );

  const cancel = async (res: IntentResponse) => {
    setError(null);
    let srcChainKey: SpokeChainKey;
    try {
      srcChainKey = sodax.config.getSpokeChainKeyFromIntentRelayChainId(
        BigInt(res.intent.srcChain) as never,
      );
    } catch {
      setError('Unsupported source chain for cancel');
      return;
    }
    if (!evmProvider) return;
    const r = await cancelSwap({
      srcChainKey,
      intent: toIntent(res),
      walletProvider: evmProvider as never,
    });
    if (!r.ok) {
      setError(
        r.error instanceof Error ? r.error.message.split('\n')[0].slice(0, 140) : 'Cancel failed',
      );
    }
  };

  const connected = Boolean(evmAccount.address || solAccount.address);
  const hf = summary ? Number(summary.healthFactor) : null;

  if (!connected) {
    return <div className="placeholder">CONNECT A WALLET TO SEE YOUR PORTFOLIO</div>;
  }

  return (
    <div className="portfolio-grid">
      <div className="stack">
        {/* balances */}
        <section className="panel">
          <div className="panel-head">
            <h2 className="panel-title">Balances — All Chains</h2>
            <span className="badge badge-neutral">
              {[evmAccount.address && 'EVM', solAccount.address && 'Solana']
                .filter(Boolean)
                .join(' + ') || '—'}
            </span>
          </div>
          <div className="table-scroll">
            <table className="data">
              <thead>
                <tr>
                  <th>Token</th>
                  <th>Chain</th>
                  <th className="r">Amount</th>
                  <th className="r">Value</th>
                </tr>
              </thead>
              <tbody>
                {TRADE_CHAINS.map(ck => (
                  <ChainBalances key={ck} chainKey={ck} prices={prices} />
                ))}
              </tbody>
            </table>
          </div>
          <p className="panel-footnote">
            Non-zero balances across connected chains; values from money-market oracle
            prices.
          </p>
        </section>

        {/* open orders */}
        <section className="panel">
          <div className="panel-head">
            <h2 className="panel-title">Open Orders</h2>
            <span className="badge badge-neutral">{open.length} open</span>
          </div>
          <div className="table-scroll">
            <table className="data">
              <thead>
                <tr>
                  <th>Intent</th>
                  <th className="r">Created</th>
                  <th className="r" aria-label="Actions" />
                </tr>
              </thead>
              <tbody>
                {open.length === 0 && (
                  <tr>
                    <td colSpan={3} className="muted">
                      No open orders.
                    </td>
                  </tr>
                )}
                {open.map(o => (
                  <tr key={o.intentHash}>
                    <td className="mono">{shortAddr(o.intentHash)}</td>
                    <td className="r muted">#{o.blockNumber}</td>
                    <td className="r">
                      <button
                        className="btn row-btn"
                        disabled={isCancelling}
                        onClick={() => cancel(o)}
                      >
                        Cancel order
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {error && (
            <p className="trade-error panel-footnote" role="alert">
              {error}
            </p>
          )}
        </section>

        {/* history */}
        <section className="panel">
          <div className="panel-head">
            <h2 className="panel-title">Recent History</h2>
          </div>
          <div className="table-scroll">
            <table className="data">
              <thead>
                <tr>
                  <th>Intent</th>
                  <th>Tx</th>
                  <th className="r">Status</th>
                </tr>
              </thead>
              <tbody>
                {history.length === 0 && (
                  <tr>
                    <td colSpan={3} className="muted">
                      No past intents for this wallet.
                    </td>
                  </tr>
                )}
                {history.map(h => (
                  <tr key={h.intentHash}>
                    <td className="mono">{shortAddr(h.intentHash)}</td>
                    <td className="mono muted">{shortAddr(h.txHash)}</td>
                    <td className="r">
                      <span className="badge badge-up">FILLED</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      </div>

      {/* MM position */}
      <section className="panel">
        <div className="panel-head">
          <h2 className="panel-title">Money Market Position</h2>
          {hf !== null && Number.isFinite(hf) && (
            <span
              className={`badge ${hf < 1.1 ? 'badge-down' : hf < 1.5 ? 'badge-warn' : 'badge-up'}`}
            >
              HF {hf > 1e6 ? '∞' : hf.toFixed(2)}
            </span>
          )}
        </div>
        <div className="panel-body">
          {!summary ? (
            <p className="muted">
              {evmAccount.address ? 'Loading position…' : 'Connect an EVM wallet.'}
            </p>
          ) : (
            <dl className="quote-meta mono">
              <div>
                <dt>Collateral</dt>
                <dd>{fmtUsd(summary.totalCollateralUSD)}</dd>
              </div>
              <div>
                <dt>Debt</dt>
                <dd>{fmtUsd(summary.totalBorrowsUSD)}</dd>
              </div>
              <div>
                <dt>Borrow power left</dt>
                <dd>{fmtUsd(summary.availableBorrowsUSD)}</dd>
              </div>
              <div>
                <dt>Net worth</dt>
                <dd>{fmtUsd(summary.netWorthUSD)}</dd>
              </div>
            </dl>
          )}
          {summary && (
            <div className="position-list">
              {summary.userReservesData
                .filter(
                  u =>
                    Number(u.underlyingBalance) > 0 || Number(u.totalBorrows) > 0,
                )
                .map(u => (
                  <div key={u.reserve.underlyingAsset} className="unstake-row mono">
                    <span>
                      <strong>{cleanSymbol(u.reserve.symbol)}</strong>
                    </span>
                    <span>
                      {Number(u.underlyingBalance) > 0 && (
                        <span className="up">
                          +{Number(u.underlyingBalance).toLocaleString('en-US', { maximumFractionDigits: 4 })}
                        </span>
                      )}{' '}
                      {Number(u.totalBorrows) > 0 && (
                        <span className="down">
                          −{Number(u.totalBorrows).toLocaleString('en-US', { maximumFractionDigits: 4 })}
                        </span>
                      )}
                    </span>
                  </div>
                ))}
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
