'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  useSodaxContext,
  useMMAllowance,
  useMMApprove,
  useSupply,
  useBorrow,
  useWithdraw,
  useRepay,
  type ReserveUsdFormat,
} from '@sodax/dapp-kit';
import { useWalletProvider, useXAccount } from '@sodax/wallet-sdk-react';
import type { XToken, SpokeChainKey } from '@sodax/types';
import type { MoneyMarketParams } from '@sodax/sdk';
import { parseUnits } from 'viem';
import { chainName } from '@/lib/config';
import { chainTypeOf, TRADE_CHAINS } from '@/lib/tokens';
import { cleanSymbol, fmtPct } from '@/lib/format';

type MMAction = 'supply' | 'borrow' | 'withdraw' | 'repay';

const ACTIONS: MMAction[] = ['supply', 'borrow', 'withdraw', 'repay'];

function errMsg(e: unknown): string {
  if (e instanceof Error) return e.message.split('\n')[0].slice(0, 140);
  return 'Transaction failed';
}

export function MMModal({
  reserve,
  onClose,
}: {
  reserve: ReserveUsdFormat;
  onClose: () => void;
}) {
  const { sodax } = useSodaxContext();
  const [action, setAction] = useState<MMAction>('supply');
  const [amount, setAmount] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  const symbol = cleanSymbol(reserve.symbol);

  // spoke chains where this asset can be sourced, matched by symbol
  const chainOptions = useMemo(() => {
    const out: { chainKey: SpokeChainKey; token: XToken }[] = [];
    for (const chainKey of TRADE_CHAINS) {
      const token = sodax.config
        .getSupportedMoneyMarketTokensByChainId(chainKey)
        .find(t => t.symbol.toUpperCase() === symbol.toUpperCase());
      if (token) out.push({ chainKey, token });
    }
    return out;
  }, [sodax, symbol]);

  const [chainKey, setChainKey] = useState<SpokeChainKey | null>(null);
  useEffect(() => {
    if (!chainKey && chainOptions.length) setChainKey(chainOptions[0].chainKey);
  }, [chainOptions, chainKey]);

  const selected = chainOptions.find(c => c.chainKey === chainKey) ?? null;
  const account = useXAccount({
    xChainType: chainKey ? chainTypeOf(chainKey) : 'EVM',
  });
  const walletProvider = useWalletProvider({
    xChainType: chainKey ? chainTypeOf(chainKey) : 'EVM',
  });

  const parsedAmount = useMemo(() => {
    if (!selected || !amount) return 0n;
    try {
      return parseUnits(amount, selected.token.decimals);
    } catch {
      return 0n;
    }
  }, [amount, selected]);

  const params: MoneyMarketParams | undefined =
    selected && chainKey && account.address && parsedAmount > 0n
      ? ({
          srcChainKey: chainKey,
          srcAddress: account.address,
          token: selected.token.address,
          amount: parsedAmount,
          action,
        } as MoneyMarketParams)
      : undefined;

  const { data: isApproved } = useMMAllowance({ params: { payload: params } });
  const { mutateAsyncSafe: approve, isPending: isApproving } = useMMApprove();
  const { mutateAsyncSafe: supply, isPending: s1 } = useSupply();
  const { mutateAsyncSafe: borrow, isPending: s2 } = useBorrow();
  const { mutateAsyncSafe: withdraw, isPending: s3 } = useWithdraw();
  const { mutateAsyncSafe: repay, isPending: s4 } = useRepay();
  const busy = isApproving || s1 || s2 || s3 || s4;

  const submit = async () => {
    if (!params || !walletProvider) return;
    setError(null);
    setDone(false);

    if (!isApproved && (action === 'supply' || action === 'repay')) {
      const a = await approve({ params, walletProvider });
      if (!a.ok) {
        setError(errMsg(a.error));
        return;
      }
    }

    const run = { supply, borrow, withdraw, repay }[action];
    const r = await run({ params: params as never, walletProvider });
    if (!r.ok) {
      setError(errMsg(r.error));
      return;
    }
    setDone(true);
    setAmount('');
  };

  const needsWallet = !account.address;
  const apy = action === 'borrow' || action === 'repay'
    ? reserve.variableBorrowAPY
    : reserve.supplyAPY;

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div
        className="modal panel"
        role="dialog"
        aria-modal="true"
        aria-label={`${symbol} money market`}
        onClick={e => e.stopPropagation()}
      >
        <div className="panel-head">
          <h2 className="panel-title">{symbol} · Money Market</h2>
          <button className="modal-close" onClick={onClose} aria-label="Close">
            ✕
          </button>
        </div>
        <div className="panel-body trade-form">
          <div className="mode-switch" role="tablist" aria-label="Action">
            {ACTIONS.map(a => (
              <button
                key={a}
                role="tab"
                aria-selected={action === a}
                className="mode-btn"
                onClick={() => {
                  setAction(a);
                  setError(null);
                  setDone(false);
                }}
              >
                {a}
              </button>
            ))}
          </div>

          <div className="field">
            <label className="field-label" htmlFor="mm-chain">
              {action === 'supply' || action === 'repay' ? 'From chain' : 'To chain'}
            </label>
            <select
              id="mm-chain"
              className="input"
              value={chainKey ?? ''}
              onChange={e => setChainKey(e.target.value as SpokeChainKey)}
            >
              {chainOptions.map(c => (
                <option key={c.chainKey} value={c.chainKey}>
                  {chainName(c.chainKey)} · {c.token.symbol}
                </option>
              ))}
            </select>
            {chainOptions.length === 0 && (
              <span className="footnote">No spoke token for {symbol} on the mounted chains.</span>
            )}
          </div>

          <div className="field">
            <label className="field-label" htmlFor="mm-amount">
              Amount
            </label>
            <input
              id="mm-amount"
              className="input amount-input"
              inputMode="decimal"
              placeholder="0.0"
              value={amount}
              onChange={e => setAmount(e.target.value.replace(/[^0-9.]/g, ''))}
            />
          </div>

          <dl className="quote-meta mono">
            <div>
              <dt>{action === 'borrow' || action === 'repay' ? 'Borrow APY' : 'Supply APY'}</dt>
              <dd className={action === 'borrow' || action === 'repay' ? '' : 'up'}>
                {fmtPct(apy)}
              </dd>
            </div>
            <div>
              <dt>Utilization</dt>
              <dd>{fmtPct(reserve.borrowUsageRatio, 0)}</dd>
            </div>
          </dl>

          <button
            className="btn btn-primary btn-wide"
            disabled={busy || !params || needsWallet}
            onClick={submit}
          >
            {needsWallet
              ? `Connect ${chainKey ? chainName(chainKey) : ''} wallet`
              : isApproving
                ? 'Approving…'
                : busy
                  ? 'Confirming…'
                  : !params
                    ? 'Enter an amount'
                    : `${action[0].toUpperCase()}${action.slice(1)} ${symbol}`}
          </button>

          {error && (
            <p className="trade-error" role="alert">
              {error}
            </p>
          )}
          {done && (
            <div className="trade-success" role="status">
              <span className="badge badge-up">CONFIRMED</span>
              <span className="mono">
                {action} {symbol}
              </span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
