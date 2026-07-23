'use client';

import { useMemo, useState } from 'react';
import {
  useStakingInfo,
  useStakingConfig,
  useStakeRatio,
  useStakeAllowance,
  useStakeApprove,
  useStake,
  useUnstake,
  useUnstakingInfoWithPenalty,
  useClaim,
} from '@sodax/dapp-kit';
import { useWalletProvider, useXAccount } from '@sodax/wallet-sdk-react';
import { ChainKeys } from '@sodax/types';
import type { Address } from '@sodax/types';
import { parseUnits, formatUnits } from 'viem';

// SODA staking runs from the hub chain (Sonic) in this terminal.
const STAKE_CHAIN = ChainKeys.SONIC_MAINNET;

function errMsg(e: unknown): string {
  if (e instanceof Error) return e.message.split('\n')[0].slice(0, 140);
  return 'Transaction failed';
}

function fmtSoda(v: bigint): string {
  const n = Number(formatUnits(v, 18));
  if (!Number.isFinite(n)) return '—';
  return n.toLocaleString('en-US', { maximumFractionDigits: 4 });
}

export function StakingPanel() {
  const account = useXAccount({ xChainType: 'EVM' });
  const walletProvider = useWalletProvider({ xChainType: 'EVM' });
  const srcAddress = account.address as Address | undefined;

  const [tab, setTab] = useState<'stake' | 'unstake'>('stake');
  const [amount, setAmount] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null);

  const { data: info } = useStakingInfo({
    params: { srcAddress, srcChainKey: STAKE_CHAIN },
  });
  const { data: config } = useStakingConfig({});
  const { data: unstaking } = useUnstakingInfoWithPenalty({
    params: { srcAddress, srcChainKey: STAKE_CHAIN },
  });

  const parsedAmount = useMemo(() => {
    if (!amount) return 0n;
    try {
      return parseUnits(amount, 18);
    } catch {
      return 0n;
    }
  }, [amount]);

  const { data: ratio } = useStakeRatio({
    params: { amount: parsedAmount > 0n ? parsedAmount : 1_000_000_000_000_000_000n },
  });

  const stakeParams =
    srcAddress && parsedAmount > 0n
      ? {
          srcChainKey: STAKE_CHAIN,
          srcAddress,
          amount: parsedAmount,
          minReceive: ratio ? (ratio[0] * 99n) / 100n : 0n,
          action: 'stake' as const,
        }
      : undefined;

  const { data: isApproved } = useStakeAllowance({
    params: stakeParams
      ? {
          payload: {
            srcChainKey: STAKE_CHAIN,
            srcAddress: stakeParams.srcAddress,
            amount: stakeParams.amount,
            minReceive: stakeParams.minReceive,
          },
        }
      : undefined,
  });

  const { mutateAsyncSafe: approve, isPending: isApproving } = useStakeApprove();
  const { mutateAsyncSafe: stake, isPending: isStaking } = useStake();
  const { mutateAsyncSafe: unstake, isPending: isUnstaking } = useUnstake();
  const { mutateAsyncSafe: claim, isPending: isClaiming } = useClaim();
  const busy = isApproving || isStaking || isUnstaking || isClaiming;

  const submit = async () => {
    if (!srcAddress || !walletProvider) return;
    setError(null);
    setDone(null);

    if (tab === 'stake') {
      if (!stakeParams) return;
      if (!isApproved) {
        const a = await approve({ params: stakeParams, walletProvider });
        if (!a.ok) {
          setError(errMsg(a.error));
          return;
        }
      }
      const r = await stake({ params: stakeParams, walletProvider });
      if (!r.ok) {
        setError(errMsg(r.error));
        return;
      }
      setDone('Staked');
    } else {
      if (parsedAmount <= 0n) return;
      const r = await unstake({
        params: {
          srcChainKey: STAKE_CHAIN,
          srcAddress,
          amount: parsedAmount,
          action: 'unstake' as const,
        },
        walletProvider,
      });
      if (!r.ok) {
        setError(errMsg(r.error));
        return;
      }
      setDone('Unstake requested');
    }
    setAmount('');
  };

  const claimOne = async (requestId: bigint, claimable: bigint) => {
    if (!srcAddress || !walletProvider) return;
    setError(null);
    const r = await claim({
      params: {
        srcChainKey: STAKE_CHAIN,
        srcAddress,
        requestId,
        amount: claimable,
        action: 'claim' as const,
      },
      walletProvider,
    });
    if (!r.ok) setError(errMsg(r.error));
    else setDone('Claimed');
  };

  const unstakeDays = config ? Number(config.unstakingPeriod) / 86400 : null;

  return (
    <section className="panel">
      <div className="panel-head">
        <h2 className="panel-title">Stake SODA</h2>
        <span className="badge badge-primary">xSODA vault</span>
      </div>
      <div className="panel-body trade-form">
        <dl className="quote-meta mono">
          <div>
            <dt>Total staked</dt>
            <dd>{info ? `${fmtSoda(info.totalStaked)} SODA` : '—'}</dd>
          </div>
          <div>
            <dt>Your xSODA</dt>
            <dd>{info && srcAddress ? fmtSoda(info.userXSodaBalance) : '—'}</dd>
          </div>
          <div>
            <dt>Your value</dt>
            <dd>{info && srcAddress ? `${fmtSoda(info.userXSodaValue)} SODA` : '—'}</dd>
          </div>
          <div>
            <dt>Unstaking period</dt>
            <dd>{unstakeDays !== null ? `${unstakeDays.toFixed(0)} days` : '—'}</dd>
          </div>
        </dl>

        <div className="mode-switch" role="tablist" aria-label="Staking action">
          {(['stake', 'unstake'] as const).map(t => (
            <button
              key={t}
              role="tab"
              aria-selected={tab === t}
              className="mode-btn"
              onClick={() => {
                setTab(t);
                setError(null);
                setDone(null);
              }}
            >
              {t}
            </button>
          ))}
        </div>

        <div className="field">
          <label className="field-label" htmlFor="stake-amount">
            {tab === 'stake' ? 'SODA amount' : 'xSODA amount'}
          </label>
          <input
            id="stake-amount"
            className="input amount-input"
            inputMode="decimal"
            placeholder="0.0"
            value={amount}
            onChange={e => setAmount(e.target.value.replace(/[^0-9.]/g, ''))}
          />
          {tab === 'stake' && ratio && parsedAmount > 0n && (
            <span className="footnote mono">≈ {fmtSoda(ratio[0])} xSODA</span>
          )}
        </div>

        <button
          className="btn btn-primary btn-wide"
          disabled={busy || !srcAddress || parsedAmount <= 0n}
          onClick={submit}
        >
          {!srcAddress
            ? 'Connect EVM wallet'
            : busy
              ? 'Confirming…'
              : tab === 'stake'
                ? 'Stake SODA'
                : 'Request unstake'}
        </button>

        {unstaking && unstaking.userUnstakeSodaRequests?.length > 0 && (
          <div className="unstake-list">
            <span className="field-label">Pending unstakes</span>
            {unstaking.userUnstakeSodaRequests.map(u => (
              <div key={u.id.toString()} className="unstake-row mono">
                <span>{fmtSoda(u.request.amount)} SODA</span>
                <button
                  className="btn"
                  disabled={busy}
                  onClick={() => claimOne(u.id, u.request.amount)}
                >
                  Claim
                </button>
              </div>
            ))}
          </div>
        )}

        {error && (
          <p className="trade-error" role="alert">
            {error}
          </p>
        )}
        {done && (
          <div className="trade-success" role="status">
            <span className="badge badge-up">{done.toUpperCase()}</span>
          </div>
        )}
      </div>
    </section>
  );
}
