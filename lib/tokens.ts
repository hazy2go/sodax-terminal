import type { XToken, SpokeChainKey, ChainType } from '@sodax/types';
import { ChainKeys } from '@sodax/types';
import { WALLET_CHAINS, isTokenAllowed } from './config';

/** Chains this terminal trades on — the EVM set + Solana (matches mounted wallets). */
export const TRADE_CHAINS = WALLET_CHAINS as readonly string[] as SpokeChainKey[];

export function chainTypeOf(chainKey: SpokeChainKey): ChainType {
  return chainKey === ChainKeys.SOLANA_MAINNET ? 'SOLANA' : 'EVM';
}

/** Flatten the SDK's supported-token record to our tradeable chains, compliance-filtered. */
export function flattenTokens(
  record: Record<string, readonly XToken[]>,
): XToken[] {
  const out: XToken[] = [];
  for (const chain of TRADE_CHAINS) {
    for (const t of record[chain] ?? []) {
      if (isTokenAllowed(t.symbol)) out.push(t);
    }
  }
  return out;
}

/** xStocks: tokenized individual equities on Solana (…x suffix), compliance-filtered. */
export function xStocksFrom(tokens: XToken[]): XToken[] {
  return tokens.filter(
    t =>
      t.chainKey === ChainKeys.SOLANA_MAINNET &&
      /^[A-Z0-9]{1,6}x$/.test(t.symbol) &&
      isTokenAllowed(t.symbol),
  );
}

export function tokenKey(t: XToken): string {
  return `${t.address}-${t.chainKey}`;
}

/** Official token logo from the SODAX assets package, named by slugified symbol. */
export function tokenLogo(symbol: string): string {
  const slug = symbol.toLowerCase().replace(/[^a-z0-9]+/g, '-');
  return `https://raw.githubusercontent.com/icon-project/sodax-sdks/main/packages/assets/token/${slug}.png`;
}
