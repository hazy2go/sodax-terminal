'use client';

import { useEffect, useRef, useState } from 'react';
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
import { shortAddr } from '@/lib/format';
import { IconWallet, IconChevron } from '@/components/icons';

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
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  const onPick = async (connector: IXConnector) => {
    setOpen(false);
    // Provider-managed chains resolve undefined; the account arrives via useXAccount.
    await connect(connector).catch(() => {});
  };

  if (account.address) {
    return (
      <button
        className="chip on"
        title={`${label}: ${account.address}`}
        onClick={() => disconnect({ xChainType: chainType })}
      >
        <span className="dot" />
        {label} {shortAddr(account.address)}
        <span className="muted">Disconnect</span>
      </button>
    );
  }

  return (
    <div className="chip-slot" ref={rootRef}>
      <button
        className="chip"
        disabled={isPending}
        aria-expanded={open}
        aria-haspopup="menu"
        onClick={() => setOpen(o => !o)}
      >
        <IconWallet size={13} />
        {isPending ? 'Connecting…' : `Connect ${label}`}
        <IconChevron size={12} />
      </button>
      {open && (
        <div className="chip-menu" role="menu">
          {connectors.length === 0 && (
            <div className="chip-item dim">No {label} wallets detected</div>
          )}
          {connectors.map(connector =>
            connector.isInstalled ? (
              <button
                key={connector.id}
                role="menuitem"
                className="chip-item"
                onClick={() => onPick(connector)}
              >
                {connector.icon && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={connector.icon} alt="" width={17} height={17} />
                )}
                {connector.name}
              </button>
            ) : (
              <a
                key={connector.id}
                role="menuitem"
                className="chip-item dim"
                href={connector.installUrl}
                target="_blank"
                rel="noreferrer"
              >
                {connector.name} — install
              </a>
            ),
          )}
        </div>
      )}
    </div>
  );
}

export function ConnectChips() {
  // Gate on persist hydration so the chips don't flicker connected/disconnected.
  const { status } = useConnectedChains();
  if (status !== 'ready') {
    return <div style={{ width: 260 }} aria-hidden />;
  }

  return (
    <>
      {SLOTS.map(s => (
        <WalletSlot key={s.chainType} {...s} />
      ))}
    </>
  );
}
