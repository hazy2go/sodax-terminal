'use client';

import {
  useXConnectors,
  useXConnect,
  useXAccount,
  useXDisconnect,
  useConnectedChains,
  sortConnectors,
  type IXConnector,
} from '@sodax/wallet-sdk-react';
import type { ChainType } from '@sodax/types';
import { ChevronDown, Wallet, ExternalLink } from 'lucide-react';
import { shortAddr } from '@/lib/format';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

const SLOTS: { chainType: ChainType; label: string }[] = [
  { chainType: 'EVM', label: 'EVM' },
  { chainType: 'SOLANA', label: 'SOL' },
];

const PREFERRED = ['metamask', 'phantom'] as const;

function WalletSlot({ chainType, label }: { chainType: ChainType; label: string }) {
  const raw = useXConnectors({ xChainType: chainType });
  const connectors = sortConnectors(raw, { preferred: PREFERRED });
  const { mutateAsync: connect, isPending } = useXConnect();
  const account = useXAccount({ xChainType: chainType });
  const disconnect = useXDisconnect();

  const onPick = async (connector: IXConnector) => {
    // Provider-managed chains resolve undefined; the account arrives via useXAccount.
    await connect(connector).catch(() => {});
  };

  if (account.address) {
    return (
      <DropdownMenu>
        <DropdownMenuTrigger
          render={<Button variant="outline" size="sm" className="fig gap-2 text-[11px]" />}
        >
          <span className="size-1.5 rounded-full bg-viable" />
          {label} {shortAddr(account.address)}
          <ChevronDown className="size-3 opacity-60" />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-56">
          <DropdownMenuLabel className="label-micro">
            {label} · connected
          </DropdownMenuLabel>
          <DropdownMenuItem disabled className="fig text-[11px] opacity-100">
            {shortAddr(account.address)}
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem
            variant="destructive"
            onClick={() => disconnect({ xChainType: chainType })}
          >
            Disconnect
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    );
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <Button variant="outline" size="sm" disabled={isPending} className="gap-2 text-[11px]" />
        }
      >
        <Wallet className="size-3.5" strokeWidth={1.5} />
        {isPending ? 'Connecting…' : `Connect ${label}`}
        <ChevronDown className="size-3 opacity-60" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuLabel className="label-micro">{label} wallets</DropdownMenuLabel>
        {connectors.length === 0 && (
          <DropdownMenuItem disabled>No {label} wallets detected</DropdownMenuItem>
        )}
        {connectors.map(connector =>
          connector.isInstalled ? (
            <DropdownMenuItem key={connector.id} onClick={() => onPick(connector)}>
              {connector.icon && (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={connector.icon} alt="" width={16} height={16} className="rounded-xs" />
              )}
              {connector.name}
            </DropdownMenuItem>
          ) : (
            <DropdownMenuItem
              key={connector.id}
              render={<a href={connector.installUrl} target="_blank" rel="noreferrer" />}
            >
              {connector.name}
              <ExternalLink className="ml-auto size-3 opacity-60" />
            </DropdownMenuItem>
          ),
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export function ConnectChips() {
  // Gate on persist hydration so the chips don't flicker connected/disconnected.
  const { status } = useConnectedChains();
  if (status !== 'ready') {
    return (
      <div className="flex gap-2">
        <Skeleton className="h-8 w-28" />
        <Skeleton className="h-8 w-28" />
      </div>
    );
  }

  return (
    <>
      {SLOTS.map(s => (
        <WalletSlot key={s.chainType} {...s} />
      ))}
    </>
  );
}
