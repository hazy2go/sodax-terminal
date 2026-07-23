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
import type {
  CreateIntentParams,
  CreateLimitOrderParams,
  SolverIntentQuoteRequest,
} from '@sodax/sdk';
import { parseUnits, formatUnits } from 'viem';
import { TokenPicker } from './TokenPicker';
import { flattenTokens, xStocksFrom, chainTypeOf } from '@/lib/tokens';
import { chainName } from '@/lib/config';

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

type Submitted = {
  kind: 'swap' | 'limit';
  pair: string;
  srcTxHash: string;
  state: 'solved' | 'created';
};

export function TradeTab() {
  const { sodax } = useSodaxContext();
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

  // xStocks mode: destination locked to the equity list
  const dstTokens = mode === 'xstocks' ? xStocks : allTokens;

  // sensible defaults per mode
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

  // live quote (3s auto-refresh) — market modes only
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

  // limit mode: minOutput comes from the user's target price
  const limitOut: bigint | null = useMemo(() => {
    if (mode !== 'limit' || !dst || !limitPrice || parsedAmount <= 0n || !src) return null;
    try {
      const price = parseUnits(limitPrice, dst.decimals); // dst per 1 src
      return (parsedAmount * price) / 10n ** BigInt(src.decimals);
    } catch {
      return null;
    }
  }, [mode, dst, limitPrice, parsedAmount, src]);

  const effectiveOut = mode === 'limit' ? limitOut : minOut;

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
    params: {
      payload: intentParams,
      srcChainKey,
      walletProvider,
    },
  });

  const { mutateAsyncSafe: approve, isPending: isApproving } = useSwapApprove();
  const { mutateAsyncSafe: swap, isPending: isSwapping } = useSwap();
  const { mutateAsyncSafe: createLimitOrder, isPending: isPlacing } =
    useCreateLimitOrder();

  const busy = isApproving || isSwapping || isPlacing;

  const needsDstWallet = dst && !dstAccount.address;
  const needsSrcWallet = src && !srcAccount.address;

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

    const pair = `${src!.symbol}→${dst!.symbol}`;
    if (mode === 'limit') {
      const r = await createLimitOrder({ params: intentParams, walletProvider });
      if (!r.ok) {
        setError(errMsg(r.error));
        return;
      }
      setSubmitted({
        kind: 'limit',
        pair,
        srcTxHash: r.value.intentDeliveryInfo.srcTxHash,
        state: 'created',
      });
    } else {
      const r = await swap({ params: intentParams, walletProvider });
      if (!r.ok) {
        setError(errMsg(r.error));
        return;
      }
      setSubmitted({
        kind: 'swap',
        pair,
        srcTxHash: r.value.intentDeliveryInfo.srcTxHash,
        state: 'solved',
      });
      setAmount('');
    }
  };

  const rate =
    quotedOut !== null && src && dst && parsedAmount > 0n
      ? Number(formatUnits(quotedOut, dst.decimals)) /
        Number(formatUnits(parsedAmount, src.decimals))
      : null;

  const actionLabel = needsSrcWallet
    ? `Connect ${src ? chainName(src.chainKey) : ''} wallet`
    : needsDstWallet
      ? `Connect ${chainName(dst!.chainKey)} wallet`
      : isApproving
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

  return (
    <div className="trade-grid">
      <section className="panel trade-panel">
        <div className="panel-head">
          <div className="mode-switch" role="tablist" aria-label="Trade mode">
            {(
              [
                ['swap', 'Swap'],
                ['xstocks', 'xStocks'],
                ['limit', 'Limit'],
              ] as const
            ).map(([m, label]) => (
              <button
                key={m}
                role="tab"
                aria-selected={mode === m}
                className="mode-btn"
                onClick={() => {
                  setMode(m);
                  setError(null);
                }}
              >
                {label}
              </button>
            ))}
          </div>
          {isQuoting && quotePayload && <span className="badge badge-neutral">quoting…</span>}
        </div>

        <div className="panel-body trade-form">
          <div className="field">
            <label className="field-label" htmlFor="pay-amount">
              You pay
            </label>
            <div className="field-row">
              <input
                id="pay-amount"
                className="input amount-input"
                inputMode="decimal"
                placeholder="0.0"
                value={amount}
                onChange={e => setAmount(e.target.value.replace(/[^0-9.]/g, ''))}
              />
              <TokenPicker label="token" tokens={allTokens} selected={src} onSelect={setSrc} />
            </div>
          </div>

          <div className="field">
            <label className="field-label" htmlFor="receive-amount">
              You receive {mode === 'limit' ? '(at your price)' : '(estimated)'}
            </label>
            <div className="field-row">
              <output id="receive-amount" className="amount-output num">
                {mode === 'limit'
                  ? limitOut && dst
                    ? Number(formatUnits(limitOut, dst.decimals)).toLocaleString('en-US', {
                        maximumFractionDigits: 6,
                      })
                    : '—'
                  : quotedOut !== null && dst
                    ? Number(formatUnits(quotedOut, dst.decimals)).toLocaleString('en-US', {
                        maximumFractionDigits: 6,
                      })
                    : '—'}
              </output>
              <TokenPicker label="token" tokens={dstTokens} selected={dst} onSelect={setDst} />
            </div>
          </div>

          {mode === 'limit' && (
            <div className="field">
              <label className="field-label" htmlFor="limit-price">
                Limit price ({dst ? `${dst.symbol} per ${src?.symbol ?? '…'}` : 'set tokens'})
              </label>
              <div className="field-row">
                <input
                  id="limit-price"
                  className="input amount-input"
                  inputMode="decimal"
                  placeholder={rate ? rate.toPrecision(6) : '0.0'}
                  value={limitPrice}
                  onChange={e => setLimitPrice(e.target.value.replace(/[^0-9.]/g, ''))}
                />
                {rate && (
                  <button
                    type="button"
                    className="btn"
                    onClick={() => setLimitPrice(rate.toPrecision(6))}
                  >
                    Use market
                  </button>
                )}
              </div>
            </div>
          )}

          <dl className="quote-meta mono">
            <div>
              <dt>Rate</dt>
              <dd>
                {rate && src && dst
                  ? `1 ${src.symbol} = ${rate.toPrecision(6)} ${dst.symbol}`
                  : '—'}
              </dd>
            </div>
            <div>
              <dt>{mode === 'limit' ? 'Fills at' : 'Min received'}</dt>
              <dd>
                {effectiveOut && dst
                  ? `${Number(formatUnits(effectiveOut, dst.decimals)).toLocaleString('en-US', { maximumFractionDigits: 6 })} ${dst.symbol}`
                  : '—'}
              </dd>
            </div>
            <div>
              <dt>Slippage</dt>
              <dd>{mode === 'limit' ? 'n/a' : '0.50%'}</dd>
            </div>
            <div>
              <dt>Route</dt>
              <dd>
                {src && dst
                  ? `${chainName(src.chainKey)} → ${chainName(dst.chainKey)}`
                  : '—'}
              </dd>
            </div>
          </dl>

          <button
            className="btn btn-primary btn-wide"
            disabled={busy || !intentParams}
            onClick={submit}
          >
            {actionLabel}
          </button>

          {error && (
            <p className="trade-error" role="alert">
              {error}
            </p>
          )}
          {submitted && (
            <div className="trade-success" role="status">
              <span className="badge badge-up">
                {submitted.kind === 'limit' ? 'ORDER PLACED' : 'SWAP FILLED'}
              </span>
              <span className="mono">{submitted.pair}</span>
              <span className="muted mono">{submitted.srcTxHash.slice(0, 10)}…</span>
            </div>
          )}
        </div>
      </section>

      <section className="panel">
        <div className="panel-head">
          <h2 className="panel-title">
            {mode === 'xstocks' ? 'Tokenized Stocks' : 'How it works'}
          </h2>
        </div>
        <div className="panel-body">
          {mode === 'xstocks' ? (
            <div className="xstock-list">
              {xStocks.length === 0 && (
                <p className="muted">No tokenized stocks served right now.</p>
              )}
              {xStocks.map(t => (
                <button
                  key={t.address}
                  className={`xstock-chip${dst?.address === t.address ? ' active' : ''}`}
                  onClick={() => setDst(t)}
                >
                  {t.symbol}
                </button>
              ))}
              <p className="footnote">
                Tokenized equities settle on Solana. Swap from any connected chain; your
                Solana wallet receives the stock token.
              </p>
            </div>
          ) : (
            <ol className="how-list">
              <li>Pick tokens on any two chains. Quotes refresh every 3 seconds.</li>
              <li>
                {mode === 'limit'
                  ? 'Set your price. The order rests until it fills or you cancel it — no expiry.'
                  : 'One signature creates a cross-chain intent.'}
              </li>
              <li>Intents are routed by solvers; funds arrive on the destination chain.</li>
              <li>Track fills under Portfolio → Open orders.</li>
            </ol>
          )}
        </div>
      </section>
    </div>
  );
}
