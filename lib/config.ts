import { ChainKeys } from '@sodax/types';
import type { PartnerFee } from '@sodax/types';
import type { ConfigService } from '@sodax/sdk';

const PARTNER_ADDRESS = process.env.NEXT_PUBLIC_PARTNER_SONIC_ADDRESS ?? '';

/**
 * Partner fee — 15 bps routed to our address on every swap.
 * (percentage is in basis points: 100 = 1%, so 15 = 0.15%)
 *
 * Undefined when the address is unset or malformed: falling back to the zero
 * address would silently burn the fee on every trade, so we charge nothing
 * rather than charge into a black hole.
 */
export const PARTNER_FEE: PartnerFee | undefined = /^0x[0-9a-fA-F]{40}$/.test(
  PARTNER_ADDRESS,
)
  ? { address: PARTNER_ADDRESS as `0x${string}`, percentage: 15 }
  : undefined;

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
  [ChainKeys.BITCOIN_MAINNET]: 'Bitcoin',
  [ChainKeys.SUI_MAINNET]: 'Sui',
  [ChainKeys.STELLAR_MAINNET]: 'Stellar',
  [ChainKeys.ICON_MAINNET]: 'ICON',
  [ChainKeys.INJECTIVE_MAINNET]: 'Injective',
  [ChainKeys.NEAR_MAINNET]: 'NEAR',
  [ChainKeys.STACKS_MAINNET]: 'Stacks',
  [ChainKeys.HEDERA_MAINNET]: 'Hedera',
  [ChainKeys.REDBELLY_MAINNET]: 'Redbelly',
};

/**
 * Chains the terminal mounts wallets for. The detector draws every chain the
 * protocol supports; these are the ones you can actually transact from here.
 */
export const WALLET_CHAINS = [
  ChainKeys.SONIC_MAINNET,
  ChainKeys.ETHEREUM_MAINNET,
  ChainKeys.BASE_MAINNET,
  ChainKeys.ARBITRUM_MAINNET,
  ChainKeys.OPTIMISM_MAINNET,
  ChainKeys.POLYGON_MAINNET,
  ChainKeys.BSC_MAINNET,
  ChainKeys.AVALANCHE_MAINNET,
  ChainKeys.SOLANA_MAINNET,
  ChainKeys.HYPEREVM_MAINNET,
  ChainKeys.LIGHTLINK_MAINNET,
  ChainKeys.KAIA_MAINNET,
] as const;

export function chainName(key: string): string {
  return CHAIN_NAMES[key] ?? key;
}

/**
 * Intent `srcChain`/`dstChain` are **intent-relay** chain ids, not EVM chain ids
 * (Solana is 1, Ethereum is 2, Base is 30 …). Resolve them through the SDK's own
 * map rather than guessing — the two numbering schemes overlap, so a hand-rolled
 * table mislabels chains instead of failing loudly.
 */
export function relayChainName(config: ConfigService, id: number): string {
  const relayId = BigInt(id);
  if (!config.isValidIntentRelayChainId(relayId)) return `#${id}`;
  return chainName(config.getSpokeChainKeyFromIntentRelayChainId(relayId));
}
