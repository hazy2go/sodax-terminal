'use client';

import { useState } from 'react';
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

const SLOTS: { chainType: ChainType; label: string }[] = [
  { chainType: 'EVM', label: 'EVM' },
  { chainType: 'SOLANA', label: 'Solana' },
];

const PREFERRED = ['metamask', 'phantom'] as const;

function short(addr: string): string {
  return `${addr.slice(0, 6)}…${addr.slice(-4)}`;
}

function WalletSlot({ chainType, label }: { chainType: ChainType; label: string }) {
  const raw = useXConnectors({ xChainType: chainType });
  const connectors = sortConnectors(raw, { preferred: PREFERRED });
  const { mutateAsync: connect, isPending } = useXConnect();
  const account = useXAccount({ xChainType: chainType });
  const disconnect = useXDisconnect();
  const [open, setOpen] = useState(false);

  const onPick = async (connector: IXConnector) => {
    setOpen(false);
    // Provider-managed chains (EVM/Solana) resolve undefined —
    // account state arrives via useXAccount on the next render.
    await connect(connector).catch(() => {});
  };

  if (account.address) {
    return (
      <button
        className="connect-btn connected"
        title={`${label}: ${account.address} — click to disconnect`}
        onClick={() => disconnect({ xChainType: chainType })}
      >
        <span className="dot" />
        {label} · {short(account.address)}
      </button>
    );
  }

  return (
    <div className="connect-slot">
      <button
        className="connect-btn"
        disabled={isPending}
        onClick={() => setOpen(o => !o)}
      >
        {isPending ? 'Connecting…' : `Connect ${label}`}
      </button>
      {open && (
        <div className="connect-menu">
          {connectors.length === 0 && <div className="connect-item">No wallets found</div>}
          {connectors.map(connector =>
            connector.isInstalled ? (
              <button
                key={connector.id}
                className="connect-item"
                onClick={() => onPick(connector)}
              >
                {connector.icon && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={connector.icon} alt="" width={18} height={18} />
                )}
                {connector.name}
              </button>
            ) : (
              <a
                key={connector.id}
                className="connect-item dim"
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

export function ConnectButton() {
  // Gate on persist hydration to avoid connected/disconnected flicker on reload.
  const { status } = useConnectedChains();
  if (status !== 'ready') {
    return <div className="connect-row" aria-hidden />;
  }

  return (
    <div className="connect-row">
      {SLOTS.map(s => (
        <WalletSlot key={s.chainType} {...s} />
      ))}
    </div>
  );
}
