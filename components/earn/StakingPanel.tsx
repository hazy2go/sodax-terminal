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
import { InstrumentHeader, InstrumentBody, Readout, FieldLabel, Note, ErrorNote } from '@/components/instrument';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';

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
    <section>
      <InstrumentHeader as="h2" title="Stake SODA">
        <Badge variant="outline">xSODA vault</Badge>
      </InstrumentHeader>

      <InstrumentBody>
        <dl className="flex flex-col gap-1.5">
          <Readout k="Total staked" v={info ? `${fmtSoda(info.totalStaked)} SODA` : '—'} />
          <Readout k="Your xSODA" v={info && srcAddress ? fmtSoda(info.userXSodaBalance) : '—'} />
          <Readout
            k="Your value"
            v={info && srcAddress ? `${fmtSoda(info.userXSodaValue)} SODA` : '—'}
          />
          <Readout
            k="Unstaking period"
            v={unstakeDays !== null ? `${unstakeDays.toFixed(0)} days` : '—'}
          />
        </dl>

        <Tabs value={tab} onValueChange={t => { setTab(t as 'stake' | 'unstake'); setError(null); setDone(null); }}>
          <TabsList className="w-full">
            <TabsTrigger value="stake" className="flex-1">Stake</TabsTrigger>
            <TabsTrigger value="unstake" className="flex-1">Unstake</TabsTrigger>
          </TabsList>
        </Tabs>

        <div className="flex flex-col gap-1.5">
          <FieldLabel htmlFor="stake-amount">
            {tab === 'stake' ? 'SODA amount' : 'xSODA amount'}
          </FieldLabel>
          <div className="flex items-stretch border border-input bg-background focus-within:border-ring">
            <input
              id="stake-amount"
              className="fig min-w-0 flex-1 bg-transparent px-3 py-2.5 text-[17px] outline-none placeholder:text-muted-foreground"
              inputMode="decimal"
              placeholder="0.0"
              value={amount}
              onChange={e => setAmount(e.target.value.replace(/[^0-9.]/g, ''))}
            />
          </div>
          {tab === 'stake' && ratio && parsedAmount > 0n && (
            <span className="label-micro">≈ {fmtSoda(ratio[0])} xSODA</span>
          )}
        </div>

        <Button
          size="lg"
          className="w-full font-semibold"
          disabled={busy || !srcAddress || parsedAmount <= 0n}
          onClick={submit}
        >
          {busy ? 'Confirming…' : tab === 'stake' ? 'Stake SODA' : 'Request unstake'}
        </Button>

        {!srcAddress && <Note>Connect an EVM wallet to stake or unstake SODA.</Note>}

        {unstaking && unstaking.userUnstakeSodaRequests?.length > 0 && (
          <div className="flex flex-col gap-2">
            <span className="label-micro">Pending unstakes</span>
            {unstaking.userUnstakeSodaRequests.map(u => (
              <div key={u.id.toString()} className="flex items-center justify-between gap-2">
                <span className="fig text-xs">{fmtSoda(u.request.amount)} SODA</span>
                <Button
                  size="sm"
                  variant="outline"
                  className="label-micro h-6 px-2"
                  disabled={busy}
                  onClick={() => claimOne(u.id, u.request.amount)}
                >
                  Claim
                </Button>
              </div>
            ))}
          </div>
        )}

        {error && <ErrorNote>{error}</ErrorNote>}
        {done && (
          <div role="status" className="flex items-center gap-2 border border-viable/40 p-2">
            <Badge variant="outline" className="border-viable/50 text-viable">{done}</Badge>
          </div>
        )}
      </InstrumentBody>
    </section>
  );
}
