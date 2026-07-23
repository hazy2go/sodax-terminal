import { ChainKeys } from '@sodax/types';
import type { PartnerFee } from '@sodax/types';

/**
 * Partner fee — 15 bps routed to our address on every swap.
 * (percentage is in basis points: 100 = 1%)
 */
export const PARTNER_FEE: PartnerFee = {
  address: (process.env.NEXT_PUBLIC_PARTNER_SONIC_ADDRESS ??
    '0x0000000000000000000000000000000000000000') as `0x${string}`,
  percentage: 15,
};

export const WALLETCONNECT_PROJECT_ID =
  process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID ?? '';

/**
 * Compliance denylist — these symbols must never render anywhere in the UI,
 * even if the SDK serves them. Applied to every token list at the source.
 */
const TOKEN_DENYLIST = new Set(['SPYX', 'QQQX']);

export function isTokenAllowed(symbol: string | undefined | null): boolean {
  if (!symbol) return true;
  return !TOKEN_DENYLIST.has(symbol.toUpperCase());
}

/** Filter helper for any SDK-served token array (objects with a `symbol` field). */
export function filterTokens<T extends { symbol: string }>(tokens: readonly T[]): T[] {
  return tokens.filter(t => isTokenAllowed(t.symbol));
}

/** Human-readable chain names for the chains this terminal surfaces. */
export const CHAIN_NAMES: Record<string, string> = {
  [ChainKeys.SONIC_MAINNET]: 'Sonic',
  [ChainKeys.ETHEREUM_MAINNET]: 'Ethereum',
  [ChainKeys.BASE_MAINNET]: 'Base',
  [ChainKeys.ARBITRUM_MAINNET]: 'Arbitrum',
  [ChainKeys.OPTIMISM_MAINNET]: 'Optimism',
  [ChainKeys.POLYGON_MAINNET]: 'Polygon',
  [ChainKeys.BSC_MAINNET]: 'BNB Chain',
  [ChainKeys.AVALANCHE_MAINNET]: 'Avalanche',
  [ChainKeys.SOLANA_MAINNET]: 'Solana',
  [ChainKeys.HYPEREVM_MAINNET]: 'HyperEVM',
  [ChainKeys.LIGHTLINK_MAINNET]: 'Lightlink',
  [ChainKeys.KAIA_MAINNET]: 'Kaia',
};

export function chainName(key: string): string {
  return CHAIN_NAMES[key] ?? key;
}
