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
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Readout, FieldLabel, Note, ErrorNote } from '@/components/instrument';

type MMAction = 'supply' | 'borrow' | 'withdraw' | 'repay';
const ACTIONS: MMAction[] = ['supply', 'borrow', 'withdraw', 'repay'];

function errMsg(e: unknown): string {
  if (e instanceof Error) return e.message.split('\n')[0].slice(0, 140);
  return 'Transaction failed';
}

/**
 * Supply/borrow needs protected focus — it ends in a signature and must show
 * fees and rates before the user commits — so it earns a modal.
 */
export function MMSheet({
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
  const account = useXAccount({ xChainType: chainKey ? chainTypeOf(chainKey) : 'EVM' });
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
  const borrowSide = action === 'borrow' || action === 'repay';
  const apy = borrowSide ? reserve.variableBorrowAPY : reserve.supplyAPY;

  return (
    <Dialog open onOpenChange={open => !open && onClose()}>
      <DialogContent className="max-w-[440px] gap-0 p-0">
        <DialogHeader className="border-b border-border px-4 py-3">
          <DialogTitle className="panel-title">{symbol} · Money market</DialogTitle>
        </DialogHeader>

        <div className="flex flex-col gap-3.5 p-4">
          <Tabs value={action} onValueChange={a => { setAction(a as MMAction); setError(null); setDone(false); }}>
            <TabsList className="w-full">
              {ACTIONS.map(a => (
                <TabsTrigger key={a} value={a} className="flex-1 capitalize">
                  {a}
                </TabsTrigger>
              ))}
            </TabsList>
          </Tabs>

          <div className="flex flex-col gap-1.5">
            <FieldLabel>
              {action === 'supply' || action === 'repay' ? 'From chain' : 'To chain'}
            </FieldLabel>
            <Select
              value={chainKey ?? ''}
              onValueChange={v => setChainKey(v as SpokeChainKey)}
            >
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Select a chain" />
              </SelectTrigger>
              <SelectContent>
                {chainOptions.map(c => (
                  <SelectItem key={c.chainKey} value={c.chainKey}>
                    {chainName(c.chainKey)} · {c.token.symbol}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {chainOptions.length === 0 && (
              <Note>No spoke token for {symbol} on the mounted chains.</Note>
            )}
          </div>

          <div className="flex flex-col gap-1.5">
            <FieldLabel htmlFor="mm-amount">Amount</FieldLabel>
            <div className="flex items-stretch border border-input bg-background focus-within:border-ring">
              <input
                id="mm-amount"
                className="fig min-w-0 flex-1 bg-transparent px-3 py-2.5 text-[17px] outline-none placeholder:text-muted-foreground"
                inputMode="decimal"
                placeholder="0.0"
                value={amount}
                onChange={e => setAmount(e.target.value.replace(/[^0-9.]/g, ''))}
              />
            </div>
          </div>

          <dl className="flex flex-col gap-1.5">
            <Readout
              k={borrowSide ? 'Borrow APY' : 'Supply APY'}
              v={fmtPct(apy)}
              tone={borrowSide ? undefined : 'up'}
            />
            <Readout k="Utilisation" v={fmtPct(reserve.borrowUsageRatio, 0)} />
          </dl>

          <Button
            size="lg"
            className="w-full font-semibold"
            disabled={busy || !params || needsWallet}
            onClick={submit}
          >
            {isApproving
              ? 'Approving…'
              : busy
                ? 'Confirming…'
                : !params
                  ? 'Enter an amount'
                  : `${action[0].toUpperCase()}${action.slice(1)} ${symbol}`}
          </Button>

          {needsWallet && (
            <Note>Connect a {chainKey ? chainName(chainKey) : ''} wallet to continue.</Note>
          )}
          {error && <ErrorNote>{error}</ErrorNote>}
          {done && (
            <div role="status" className="flex items-center gap-2 border border-viable/40 p-2">
              <Badge variant="outline" className="border-viable/50 text-viable">
                Confirmed
              </Badge>
              <span className="fig text-[11px] capitalize">
                {action} {symbol}
              </span>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
