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
import { InstrumentHeader, InstrumentBody, Section, Readout, Note } from '@/components/instrument';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';

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
        <TableRow key={`${r.token.address}-${chainKey}`}>
          <TableCell className="fig py-1.5">
            <span className="flex items-center gap-2">
              <TokenMark token={r.token} size={15} />
              {r.token.symbol}
            </span>
          </TableCell>
          <TableCell className="py-1.5 text-muted-foreground">{chainName(chainKey)}</TableCell>
          <TableCell className="fig py-1.5 text-right">
            {r.amount.toLocaleString('en-US', { maximumFractionDigits: 5 })}
          </TableCell>
          <TableCell className="fig py-1.5 text-right">
            {r.usd !== null ? fmtUsd(r.usd, { compact: true }) : '—'}
          </TableCell>
        </TableRow>
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
        <InstrumentHeader title="Portfolio" />
        <InstrumentBody>
          <Note>
            Connect a wallet to see balances, open orders and your money-market position.
            The graph keeps running either way.
          </Note>
        </InstrumentBody>
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

      <InstrumentHeader title="Portfolio">
        {summary && (
          <Badge
            variant="outline"
            className={
              !hasDebt
                ? 'border-viable/50 text-viable'
                : hfRaw! < 1.1
                  ? 'border-destructive/50 text-destructive'
                  : hfRaw! < 1.5
                    ? 'border-primary/50 text-primary'
                    : 'border-viable/50 text-viable'
            }
          >
            {hasDebt ? `HF ${hfRaw!.toFixed(2)}` : 'No debt'}
          </Badge>
        )}
      </InstrumentHeader>

      <InstrumentBody>
        <dl className="flex flex-col gap-1.5">
          <Readout k="Collateral" v={summary ? fmtUsd(summary.totalCollateralUSD) : '—'} />
          <Readout k="Debt" v={summary ? fmtUsd(summary.totalBorrowsUSD) : '—'} />
          <Readout k="Borrow power" v={summary ? fmtUsd(summary.availableBorrowsUSD) : '—'} />
          <Readout k="Net worth" v={summary ? fmtUsd(summary.netWorthUSD) : '—'} />
        </dl>
      </InstrumentBody>

      <Section>
        <InstrumentHeader as="h2" title="Balances" />
        <Table className="text-xs">
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              <TableHead className="label-micro h-8">Token</TableHead>
              <TableHead className="label-micro h-8">Chain</TableHead>
              <TableHead className="label-micro h-8 text-right">Amount</TableHead>
              <TableHead className="label-micro h-8 text-right">Value</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {TRADE_CHAINS.map(ck => (
              <ChainBalances key={ck} chainKey={ck} prices={prices} />
            ))}
          </TableBody>
        </Table>
      </Section>

      <Section>
        <InstrumentHeader as="h2" title="Open orders">
          <Badge variant="outline">{open.length}</Badge>
        </InstrumentHeader>
        <Table className="text-xs">
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              <TableHead className="label-micro h-8">Intent</TableHead>
              <TableHead className="label-micro h-8 text-right">Block</TableHead>
              <TableHead className="h-8" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {open.length === 0 && (
              <TableRow>
                <TableCell colSpan={3} className="py-3 text-center text-muted-foreground">
                  No open orders.
                </TableCell>
              </TableRow>
            )}
            {open.map(o => (
              <TableRow key={o.intentHash}>
                <TableCell className="fig py-1.5">{shortAddr(o.intentHash)}</TableCell>
                <TableCell className="fig py-1.5 text-right text-muted-foreground">
                  {o.blockNumber}
                </TableCell>
                <TableCell className="py-1.5 text-right">
                  <Button
                    size="sm"
                    variant="outline"
                    className="label-micro h-6 px-2"
                    disabled={isCancelling}
                    onClick={() => cancel(o)}
                  >
                    Cancel
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
        {error && (
          <div className="p-3.5">
            <p role="alert" className="border border-destructive/45 p-2 text-[11px] text-destructive">
              {error}
            </p>
          </div>
        )}
      </Section>

      <Section>
        <InstrumentHeader as="h2" title="Recent" />
        <Table className="text-xs">
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              <TableHead className="label-micro h-8">Intent</TableHead>
              <TableHead className="label-micro h-8">Tx</TableHead>
              <TableHead className="label-micro h-8 text-right">Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {history.length === 0 && (
              <TableRow>
                <TableCell colSpan={3} className="py-3 text-center text-muted-foreground">
                  No past intents.
                </TableCell>
              </TableRow>
            )}
            {history.map(h => (
              <TableRow key={h.intentHash}>
                <TableCell className="fig py-1.5">{shortAddr(h.intentHash)}</TableCell>
                <TableCell className="fig py-1.5 text-muted-foreground">
                  {shortAddr(h.txHash)}
                </TableCell>
                <TableCell className="py-1.5 text-right">
                  {/* The list endpoint reports open/closed only — it can't tell a
                      fill from a cancellation or an expiry, so don't claim one. */}
                  <Badge variant="outline">Closed</Badge>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Section>
    </>
  );
}
