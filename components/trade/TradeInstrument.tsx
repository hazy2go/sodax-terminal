'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  useSodaxContext,
  useQuote,
  useSwapAllowance,
  useSwapApprove,
  useSwap,
  useCreateLimitOrder,
} from '@sodax/dapp-kit';
import { useWalletProvider, useXAccount } from '@sodax/wallet-sdk-react';
import type { XToken, SpokeChainKey } from '@sodax/types';
import type { CreateIntentParams, SolverIntentQuoteRequest } from '@sodax/sdk';
import { parseUnits, formatUnits } from 'viem';
import { TokenPicker } from './TokenPicker';
import { flattenTokens, xStocksFrom, chainTypeOf } from '@/lib/tokens';
import { chainName } from '@/lib/config';
import { useFocus } from '@/components/detector/focus';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  InstrumentHeader,
  InstrumentBody,
  Readout,
  FieldLabel,
  Note,
  ErrorNote,
} from '@/components/instrument';

const SLIPPAGE_BPS = 50n; // 0.5%

type Mode = 'swap' | 'xstocks' | 'limit';

function useDebounced<T>(value: T, ms: number): T {
  const [v, setV] = useState(value);
  useEffect(() => {
    const id = setTimeout(() => setV(value), ms);
    return () => clearTimeout(id);
  }, [value, ms]);
  return v;
}

function errMsg(e: unknown): string {
  if (e instanceof Error) return e.message.split('\n')[0].slice(0, 140);
  return 'Transaction failed';
}

type Submitted = { kind: 'swap' | 'limit'; pair: string; srcTxHash: string };

export function TradeInstrument() {
  const { sodax } = useSodaxContext();
  const { setRoute } = useFocus();
  const [mode, setMode] = useState<Mode>('swap');
  const [src, setSrc] = useState<XToken | null>(null);
  const [dst, setDst] = useState<XToken | null>(null);
  const [amount, setAmount] = useState('');
  const [limitPrice, setLimitPrice] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState<Submitted | null>(null);

  const allTokens = useMemo(
    () => flattenTokens(sodax.swaps.getSupportedSwapTokens()),
    [sodax],
  );
  const xStocks = useMemo(() => xStocksFrom(allTokens), [allTokens]);
  const dstTokens = mode === 'xstocks' ? xStocks : allTokens;

  useEffect(() => {
    if (!src && allTokens.length) {
      setSrc(allTokens.find(t => t.symbol === 'USDC') ?? allTokens[0]);
    }
  }, [allTokens, src]);

  useEffect(() => {
    if (mode === 'xstocks' && dst && !xStocks.some(t => t.address === dst.address)) {
      setDst(xStocks[0] ?? null);
    }
  }, [mode, dst, xStocks]);

  const srcChainKey = src?.chainKey as SpokeChainKey | undefined;
  const srcAccount = useXAccount(
    srcChainKey ? { xChainType: chainTypeOf(srcChainKey) } : { xChainType: 'EVM' },
  );
  const dstAccount = useXAccount(
    dst ? { xChainType: chainTypeOf(dst.chainKey) } : { xChainType: 'EVM' },
  );
  const walletProvider = useWalletProvider(
    srcChainKey ? { xChainType: chainTypeOf(srcChainKey) } : { xChainType: 'EVM' },
  );

  const debouncedAmount = useDebounced(amount, 400);
  const parsedAmount = useMemo(() => {
    if (!src || !debouncedAmount) return 0n;
    try {
      return parseUnits(debouncedAmount, src.decimals);
    } catch {
      return 0n;
    }
  }, [debouncedAmount, src]);

  const quotePayload: SolverIntentQuoteRequest | undefined =
    src && dst && parsedAmount > 0n && src.address !== dst.address
      ? {
          token_src: src.address,
          token_dst: dst.address,
          token_src_blockchain_id: src.chainKey,
          token_dst_blockchain_id: dst.chainKey,
          amount: parsedAmount,
          quote_type: 'exact_input',
        }
      : undefined;

  const { data: quoteResult, isFetching: isQuoting } = useQuote({
    params: { payload: quotePayload },
  });

  const quotedOut: bigint | null =
    quoteResult?.ok && quotePayload ? BigInt(quoteResult.value.quoted_amount) : null;

  const minOut: bigint | null =
    quotedOut !== null ? (quotedOut * (10000n - SLIPPAGE_BPS)) / 10000n : null;

  const limitOut: bigint | null = useMemo(() => {
    if (mode !== 'limit' || !dst || !limitPrice || parsedAmount <= 0n || !src) return null;
    try {
      const price = parseUnits(limitPrice, dst.decimals);
      return (parsedAmount * price) / 10n ** BigInt(src.decimals);
    } catch {
      return null;
    }
  }, [mode, dst, limitPrice, parsedAmount, src]);

  const effectiveOut = mode === 'limit' ? limitOut : minOut;

  // Light the composed route inside the detector — same surface, not two.
  useEffect(() => {
    if (!src || !dst || src.chainKey === dst.chainKey) {
      setRoute(null);
      return;
    }
    setRoute({
      srcChainKey: src.chainKey as SpokeChainKey,
      dstChainKey: dst.chainKey as SpokeChainKey,
      srcSymbol: src.symbol,
      dstSymbol: dst.symbol,
      state: isQuoting ? 'quoting' : quotedOut !== null ? 'quoted' : 'composing',
    });
  }, [src, dst, isQuoting, quotedOut, setRoute]);

  useEffect(() => () => setRoute(null), [setRoute]);

  const intentParams: CreateIntentParams | undefined =
    src &&
    dst &&
    srcChainKey &&
    parsedAmount > 0n &&
    effectiveOut !== null &&
    effectiveOut > 0n &&
    srcAccount.address &&
    dstAccount.address
      ? {
          inputToken: src.address,
          outputToken: dst.address,
          inputAmount: parsedAmount,
          minOutputAmount: effectiveOut,
          // Placeholder. `0n` means "never expires" — right for a limit order,
          // wrong for a market swap, which gets a real deadline at submit.
          deadline: 0n,
          allowPartialFill: mode === 'limit',
          srcChainKey,
          dstChainKey: dst.chainKey,
          srcAddress: srcAccount.address,
          dstAddress: dstAccount.address,
          data: '0x',
        }
      : undefined;

  const { data: isApproved } = useSwapAllowance({
    params: { payload: intentParams, srcChainKey, walletProvider },
  });

  const { mutateAsyncSafe: approve, isPending: isApproving } = useSwapApprove();
  const { mutateAsyncSafe: swap, isPending: isSwapping } = useSwap();
  const { mutateAsyncSafe: createLimitOrder, isPending: isPlacing } = useCreateLimitOrder();

  const busy = isApproving || isSwapping || isPlacing;
  const needsDstWallet = Boolean(dst && !dstAccount.address);
  const needsSrcWallet = Boolean(src && !srcAccount.address);

  const submit = async () => {
    if (!intentParams || !walletProvider) return;
    setError(null);
    setSubmitted(null);

    if (!isApproved) {
      const a = await approve({ params: intentParams, walletProvider });
      if (!a.ok) {
        setError(errMsg(a.error));
        return;
      }
    }

    const pair = `${src!.symbol} → ${dst!.symbol}`;
    if (mode === 'limit') {
      const r = await createLimitOrder({ params: intentParams, walletProvider });
      if (!r.ok) {
        setError(errMsg(r.error));
        return;
      }
      setSubmitted({ kind: 'limit', pair, srcTxHash: r.value.intentDeliveryInfo.srcTxHash });
    } else {
      // A market swap must expire. getSwapDeadline() reads hub block time;
      // fall back to a local 5-minute offset rather than shipping 0n.
      const dl = await sodax.swaps.getSwapDeadline();
      const deadline = dl.ok ? dl.value : BigInt(Math.floor(Date.now() / 1000)) + 300n;
      const r = await swap({ params: { ...intentParams, deadline }, walletProvider });
      if (!r.ok) {
        setError(errMsg(r.error));
        return;
      }
      setSubmitted({ kind: 'swap', pair, srcTxHash: r.value.intentDeliveryInfo.srcTxHash });
      setAmount('');
    }
  };

  const rate =
    quotedOut !== null && src && dst && parsedAmount > 0n
      ? Number(formatUnits(quotedOut, dst.decimals)) /
        Number(formatUnits(parsedAmount, src.decimals))
      : null;

  // Wallet prompts are a hint, not a disabled button's label.
  const walletHint = needsSrcWallet
    ? `Connect a ${src ? chainName(src.chainKey) : ''} wallet to trade this pair.`
    : needsDstWallet
      ? `Connect a ${chainName(dst!.chainKey)} wallet to receive ${dst!.symbol}.`
      : null;

  const actionLabel = isApproving
    ? 'Approving…'
    : isSwapping
      ? 'Swapping…'
      : isPlacing
        ? 'Placing order…'
        : !intentParams
          ? mode === 'limit' && !limitOut
            ? 'Set amount and price'
            : 'Enter an amount'
          : isApproved
            ? mode === 'limit'
              ? 'Place limit order'
              : 'Swap'
            : mode === 'limit'
              ? 'Approve and place order'
              : 'Approve and swap';

  const fmtOut = (v: bigint | null) =>
    v !== null && dst
      ? Number(formatUnits(v, dst.decimals)).toLocaleString('en-US', {
          maximumFractionDigits: 6,
        })
      : '—';

  return (
    <>
      <InstrumentHeader title="Trade">
        {isQuoting && quotePayload && (
          <Badge variant="outline" className="gap-1.5 border-flow/45 text-flow">
            <span className="size-1.5 animate-pulse rounded-full bg-flow" />
            Quoting
          </Badge>
        )}
      </InstrumentHeader>

      <InstrumentBody>
        <Tabs value={mode} onValueChange={v => { setMode(v as Mode); setError(null); }}>
          <TabsList className="w-full">
            <TabsTrigger value="swap" className="flex-1">Swap</TabsTrigger>
            <TabsTrigger value="xstocks" className="flex-1">xStocks</TabsTrigger>
            <TabsTrigger value="limit" className="flex-1">Limit</TabsTrigger>
          </TabsList>
        </Tabs>

        <div className="flex flex-col gap-1.5">
          <FieldLabel htmlFor="pay">You pay</FieldLabel>
          <div className="flex items-stretch border border-input bg-background focus-within:border-ring">
            <input
              id="pay"
              className="fig min-w-0 flex-1 bg-transparent px-3 py-2.5 text-[17px] outline-none placeholder:text-muted-foreground"
              inputMode="decimal"
              placeholder="0.0"
              value={amount}
              onChange={e => setAmount(e.target.value.replace(/[^0-9.]/g, ''))}
            />
            <TokenPicker label="token" tokens={allTokens} selected={src} onSelect={setSrc} />
          </div>
        </div>

        <div className="flex flex-col gap-1.5">
          <FieldLabel htmlFor="get">
            You receive {mode === 'limit' ? '· at your price' : '· estimated'}
          </FieldLabel>
          <div className="flex items-stretch border border-input bg-background">
            <output
              id="get"
              className={`fig flex min-w-0 flex-1 items-center px-3 py-2.5 text-[17px] ${
                quotedOut === null ? 'text-muted-foreground' : 'text-foreground'
              }`}
            >
              {mode === 'limit' ? fmtOut(limitOut) : fmtOut(quotedOut)}
            </output>
            <TokenPicker label="token" tokens={dstTokens} selected={dst} onSelect={setDst} />
          </div>
        </div>

        {mode === 'limit' && (
          <div className="flex flex-col gap-1.5">
            <FieldLabel htmlFor="limit">
              Limit price · {dst && src ? `${dst.symbol} per ${src.symbol}` : 'set tokens'}
            </FieldLabel>
            <div className="flex items-stretch border border-input bg-background focus-within:border-ring">
              <input
                id="limit"
                className="fig min-w-0 flex-1 bg-transparent px-3 py-2.5 text-[17px] outline-none placeholder:text-muted-foreground"
                inputMode="decimal"
                placeholder={rate ? rate.toPrecision(6) : '0.0'}
                value={limitPrice}
                onChange={e => setLimitPrice(e.target.value.replace(/[^0-9.]/g, ''))}
              />
              {rate && (
                <Button
                  variant="ghost"
                  className="label-micro h-auto rounded-none border-l border-input px-3"
                  onClick={() => setLimitPrice(rate.toPrecision(6))}
                >
                  Market
                </Button>
              )}
            </div>
          </div>
        )}

        <dl className="flex flex-col gap-1.5">
          <Readout
            k="Rate"
            v={rate && src && dst ? `${rate.toPrecision(6)} ${dst.symbol}` : '—'}
          />
          <Readout
            k={mode === 'limit' ? 'Fills at' : 'Min received'}
            v={effectiveOut && dst ? `${fmtOut(effectiveOut)} ${dst.symbol}` : '—'}
          />
          <Readout k="Slippage" v={mode === 'limit' ? 'n/a' : '0.50%'} />
          <Readout k="Expiry" v={mode === 'limit' ? 'Good till cancelled' : '5 min'} />
          <Readout
            k="Route"
            v={src && dst ? `${chainName(src.chainKey)} → ${chainName(dst.chainKey)}` : '—'}
          />
        </dl>

        <Button
          size="lg"
          className="w-full font-semibold"
          disabled={busy || !intentParams}
          onClick={submit}
        >
          {actionLabel}
        </Button>

        {walletHint && <Note>{walletHint}</Note>}
        {error && <ErrorNote>{error}</ErrorNote>}

        {submitted && (
          <div role="status" className="flex items-center gap-2 border border-viable/40 p-2">
            <Badge variant="outline" className="border-viable/50 text-viable">
              {submitted.kind === 'limit' ? 'Order placed' : 'Swap sent'}
            </Badge>
            <span className="fig text-[11px]">{submitted.pair}</span>
            <span className="fig text-[11px] text-muted-foreground">
              {submitted.srcTxHash.slice(0, 10)}…
            </span>
          </div>
        )}

        {mode === 'xstocks' && (
          <div className="border-t border-border pt-3">
            <span className="label-micro">Tokenized equities · settle on Solana</span>
            <div className="mt-2 flex flex-wrap gap-1.5">
              {xStocks.length === 0 && <Note>None served right now.</Note>}
              {xStocks.map(t => (
                <Button
                  key={t.address}
                  size="sm"
                  variant={dst?.address === t.address ? 'default' : 'outline'}
                  className="fig h-7 text-[11px]"
                  onClick={() => setDst(t)}
                >
                  {t.symbol}
                </Button>
              ))}
            </div>
          </div>
        )}
      </InstrumentBody>
    </>
  );
}
