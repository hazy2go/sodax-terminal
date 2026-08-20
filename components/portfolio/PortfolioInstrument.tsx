'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  useSodaxContext,
  useXBalances,
  useReservesUsdFormat,
  useUserFormattedSummary,
  useBackendUserIntents,
  useGetUserHubWalletAddress,
  useCancelSwap,
} from '@sodax/dapp-kit';
import { useWalletProvider, useXAccount, useXService } from '@sodax/wallet-sdk-react';
import { ChainKeys } from '@sodax/types';
import type { SpokeChainKey, XToken, Address, Hex } from '@sodax/types';
import type { Intent, IntentResponse } from '@sodax/sdk';
import { formatUnits } from 'viem';
import { chainName, isTokenAllowed } from '@/lib/config';
import { TRADE_CHAINS, chainTypeOf } from '@/lib/tokens';
import { cleanSymbol, fmtUsd, shortAddr } from '@/lib/format';
import { TokenMark } from '@/components/trade/TokenPicker';

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
    () =>
      sodax.config
        .getSupportedSwapTokensByChainId(chainKey)
        .filter(t => isTokenAllowed(t.symbol)),
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
            <span className="asset-cell">
              <TokenMark token={r.token} size={15} />
              {r.token.symbol}
            </span>
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

/**
 * The backend indexes intents under the hub wallet the SDK derives from
 * (spoke chain, spoke address) — not the user's EOA — and each spoke chain
 * derives a different one. So a full history means one query per chain.
 */
function ChainIntents({
  chainKey,
  spokeAddress,
  onItems,
}: {
  chainKey: SpokeChainKey;
  spokeAddress: string | undefined;
  onItems: (chainKey: SpokeChainKey, items: IntentResponse[]) => void;
}) {
  const { data: hubAddress } = useGetUserHubWalletAddress({
    params: { spokeChainId: chainKey, spokeAddress },
  });
  const { data } = useBackendUserIntents({ params: { userAddress: hubAddress } });
  const items = data?.items;

  useEffect(() => {
    onItems(chainKey, items ?? []);
  }, [chainKey, items, onItems]);

  return null;
}

export function PortfolioInstrument() {
  const { sodax } = useSodaxContext();
  const evmAccount = useXAccount({ xChainType: 'EVM' });
  const solAccount = useXAccount({ xChainType: 'SOLANA' });
  const evmProvider = useWalletProvider({ xChainType: 'EVM' });
  const solProvider = useWalletProvider({ xChainType: 'SOLANA' });
  const prices = useSymbolPrices();
  const [error, setError] = useState<string | null>(null);

  const { data: summary } = useUserFormattedSummary({
    params: { spokeChainKey: ChainKeys.SONIC_MAINNET, userAddress: evmAccount.address },
  });

  const [intentsByChain, setIntentsByChain] = useState<Record<string, IntentResponse[]>>({});

  const onItems = useCallback((chainKey: SpokeChainKey, items: IntentResponse[]) => {
    setIntentsByChain(prev => {
      const before = prev[chainKey];
      if (before && before.length === items.length) {
        const same = before.every((b, i) => b.intentHash === items[i]?.intentHash);
        if (same) return prev;
      }
      return { ...prev, [chainKey]: items };
    });
  }, []);

  const { mutateAsyncSafe: cancelSwap, isPending: isCancelling } = useCancelSwap();

  const allIntents = useMemo(() => {
    const seen = new Set<string>();
    const out: IntentResponse[] = [];
    for (const items of Object.values(intentsByChain)) {
      for (const i of items) {
        if (seen.has(i.intentHash)) continue;
        seen.add(i.intentHash);
        out.push(i);
      }
    }
    return out.sort((a, b) => b.blockNumber - a.blockNumber);
  }, [intentsByChain]);

  const open = useMemo(() => allIntents.filter(i => i.open), [allIntents]);
  const history = useMemo(() => allIntents.filter(i => !i.open).slice(0, 8), [allIntents]);

  const cancel = async (res: IntentResponse) => {
    setError(null);
    const relayId = BigInt(res.intent.srcChain);
    if (!sodax.config.isValidIntentRelayChainId(relayId)) {
      setError('Unsupported source chain for cancel');
      return;
    }
    const srcChainKey = sodax.config.getSpokeChainKeyFromIntentRelayChainId(relayId);

    // Sign with the wallet that owns the intent's source chain.
    const provider = chainTypeOf(srcChainKey) === 'SOLANA' ? solProvider : evmProvider;
    if (!provider) {
      setError(`Connect a ${chainName(srcChainKey)} wallet to cancel this order`);
      return;
    }

    const r = await cancelSwap({
      srcChainKey,
      intent: toIntent(res),
      walletProvider: provider as never,
    });
    if (!r.ok) {
      setError(
        r.error instanceof Error
          ? r.error.message.split('\n')[0].slice(0, 140)
          : 'Cancel failed',
      );
    }
  };

  const connected = Boolean(evmAccount.address || solAccount.address);

  // formatUserSummary returns "-1" when the user has no borrows: a sentinel,
  // not a ratio. Comparing it to liquidation thresholds paints a debt-free
  // position as critical.
  const hfRaw = summary ? Number(summary.healthFactor) : null;
  const hasDebt = hfRaw !== null && hfRaw >= 0;

  if (!connected) {
    return (
      <>
        <div className="instr-head">
          <h1 className="instr-title">Portfolio</h1>
        </div>
        <div className="instr-body">
          <p className="note">
            Connect a wallet to see balances, open orders and your money-market position.
            The detector keeps running either way.
          </p>
        </div>
      </>
    );
  }

  return (
    <>
      {TRADE_CHAINS.map(ck => {
        const spokeAddress =
          chainTypeOf(ck) === 'SOLANA' ? solAccount.address : evmAccount.address;
        if (!spokeAddress) return null;
        return (
          <ChainIntents key={ck} chainKey={ck} spokeAddress={spokeAddress} onItems={onItems} />
        );
      })}

      <div className="instr-head">
        <h1 className="instr-title">Portfolio</h1>
        {summary && (
          <span
            className={`badge ${
              !hasDebt
                ? 'badge-up'
                : hfRaw! < 1.1
                  ? 'badge-down'
                  : hfRaw! < 1.5
                    ? 'badge-warn'
                    : 'badge-up'
            }`}
          >
            {hasDebt ? `HF ${hfRaw!.toFixed(2)}` : 'No debt'}
          </span>
        )}
      </div>

      <div className="instr-body">
        <dl className="readout">
          <Row k="Collateral" v={summary ? fmtUsd(summary.totalCollateralUSD) : '—'} />
          <Row k="Debt" v={summary ? fmtUsd(summary.totalBorrowsUSD) : '—'} />
          <Row k="Borrow power" v={summary ? fmtUsd(summary.availableBorrowsUSD) : '—'} />
          <Row k="Net worth" v={summary ? fmtUsd(summary.netWorthUSD) : '—'} />
        </dl>
      </div>

      <div className="instr-section">
        <div className="instr-head">
          <h2 className="instr-title">Balances</h2>
        </div>
        <div className="table-wrap">
          <table className="data">
            <thead>
              <tr>
                <th scope="col">Token</th>
                <th scope="col">Chain</th>
                <th scope="col" className="r">
                  Amount
                </th>
                <th scope="col" className="r">
                  Value
                </th>
              </tr>
            </thead>
            <tbody>
              {TRADE_CHAINS.map(ck => (
                <ChainBalances key={ck} chainKey={ck} prices={prices} />
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="instr-section">
        <div className="instr-head">
          <h2 className="instr-title">Open orders</h2>
          <span className="badge badge-neutral">{open.length}</span>
        </div>
        <div className="table-wrap">
          <table className="data">
            <thead>
              <tr>
                <th scope="col">Intent</th>
                <th scope="col" className="r">
                  Block
                </th>
                <th scope="col" className="r" aria-label="Actions" />
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
                  <td>{shortAddr(o.intentHash)}</td>
                  <td className="r muted">{o.blockNumber}</td>
                  <td className="r">
                    <button
                      className="btn btn-row"
                      disabled={isCancelling}
                      onClick={() => cancel(o)}
                    >
                      Cancel
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {error && (
          <p className="alert" style={{ margin: 14 }} role="alert">
            {error}
          </p>
        )}
      </div>

      <div className="instr-section">
        <div className="instr-head">
          <h2 className="instr-title">Recent</h2>
        </div>
        <div className="table-wrap">
          <table className="data">
            <thead>
              <tr>
                <th scope="col">Intent</th>
                <th scope="col">Tx</th>
                <th scope="col" className="r">
                  Status
                </th>
              </tr>
            </thead>
            <tbody>
              {history.length === 0 && (
                <tr>
                  <td colSpan={3} className="muted">
                    No past intents.
                  </td>
                </tr>
              )}
              {history.map(h => (
                <tr key={h.intentHash}>
                  <td>{shortAddr(h.intentHash)}</td>
                  <td className="muted">{shortAddr(h.txHash)}</td>
                  <td className="r">
                    {/* The list endpoint reports open/closed only — it can't tell
                        a fill from a cancellation or an expiry, so don't claim one. */}
                    <span className="badge badge-neutral">Closed</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}

function Row({ k, v }: { k: string; v: string }) {
  return (
    <div className="readout-row">
      <dt>{k}</dt>
      <span className="rule" />
      <dd>{v}</dd>
    </div>
  );
}
