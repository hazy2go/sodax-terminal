'use client';

import { QueryClientProvider } from '@tanstack/react-query';
import { SodaxProvider, createSodaxQueryClient } from '@sodax/dapp-kit';
import { SodaxWalletProvider, type SodaxWalletConfig } from '@sodax/wallet-sdk-react';
import type { SodaxOptions } from '@sodax/sdk';
import { PARTNER_FEE, WALLETCONNECT_PROJECT_ID } from '@/lib/config';

const queryClient = createSodaxQueryClient();

// Static module-level configs — SodaxProvider tracks config by reference,
// so these must never be recreated per render.
const sodaxConfig: SodaxOptions = {
  swaps: { partnerFee: PARTNER_FEE },
};

// WalletConnect init touches indexedDB — browser only, never during SSR.
const isBrowser = typeof window !== 'undefined';

const walletConfig: SodaxWalletConfig = {
  EVM: {
    ssr: true,
    ...(isBrowser && WALLETCONNECT_PROJECT_ID
      ? { walletConnect: { projectId: WALLETCONNECT_PROJECT_ID } }
      : {}),
  },
  SOLANA: {},
};

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <SodaxProvider config={sodaxConfig}>
      <QueryClientProvider client={queryClient}>
        <SodaxWalletProvider config={walletConfig}>{children}</SodaxWalletProvider>
      </QueryClientProvider>
    </SodaxProvider>
  );
}
