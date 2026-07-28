# SODAX Terminal

A professional cross-chain DeFi terminal — swaps, tokenized stocks, cross-chain limit
orders, lending, staking, and a live portfolio — built entirely on the [SODAX SDK](https://sodax.com).

**Live:** https://sodax-terminal.vercel.app

Built in a single session with an AI agent and the SODAX Builder SDK, to show how much
real DeFi product surface one SDK covers. Think of it as the DeFi section that could live
inside any neobanking app.

## Tabs

| Tab | What it does |
|-----|--------------|
| **Analytics** | Live protocol data with no wallet: TVL, 27 lending markets w/ live rates, open intent orderbook |
| **Trade** | Cross-chain swaps (live 3s quotes), tokenized stocks (xStocks), cross-chain limit orders |
| **Earn** | Lending table ranked by yield, supply / borrow / withdraw / repay, SODA staking |
| **Portfolio** | Cross-chain balances, lending position w/ health factor, open orders + cancel, history |

## Stack

- **SODAX SDK** `@2.0.0-rc.21` — `@sodax/sdk`, `@sodax/dapp-kit` (React Query hooks),
  `@sodax/wallet-sdk-react` (EVM + Solana)
- Next.js 15 (App Router) · React 19 · TypeScript
- wagmi / viem · TanStack Query
- Custom CSS design system (OKLCH tokens, no component library)
- Deploy: Vercel

## Highlights

- **Intent-based swaps** — one signature, solvers route it, live quotes every 3s
- **xStocks** — swap any token into tokenized equities that settle on Solana
- **Cross-chain limit orders** — set a price, the order rests with no expiry until it fills or you cancel
- **Money market** — all reserves in one table, supply/borrow/withdraw/repay from whatever chain your funds are on
- **Cross-chain portfolio** — balances, health factor, and open-order management in one place
- **Builder monetization** — a partner fee on every swap, configured in one line

Swaps are intent-based and routed by solvers.

## Run locally

```bash
npm install                    # .npmrc sets legacy-peer-deps=true
cp .env.example .env.local     # then fill in the values below
npm run dev                    # http://localhost:3000
```

### Environment variables

| Variable | Purpose |
|----------|---------|
| `NEXT_PUBLIC_PARTNER_SONIC_ADDRESS` | Address that receives the partner fee on swaps |
| `NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID` | WalletConnect project id (optional) |

## Roadmap

- Live intent status tracking (watch a swap settle in real time)
- Bridge tab, DEX / liquidity pools, leverage-yield vaults (all supported by the SDK)
- More chains: Sui, Bitcoin, Stellar, Injective, NEAR, Stacks
- Mobile layout pass, onboarding + empty states

## Notes

Built with [Claude Code](https://claude.com/claude-code). The SODAX SDK ships AI-readable
doc-skills, so the agent could read the SDK's own documentation while building.
