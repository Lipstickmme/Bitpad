# Bitpad

The lightweight TON launchpad for **paired tokens**. Launch a jetton paired with a stock (SPYx, NVDAx…),
a commodity (XAUt), a TON jetton (TON, USDT, $GRAM) or a cross-chain asset — and put the liquidity
**straight into a STON.fi pool**. No bonding curve, no graduation: the pool is the market from block one.

Built as a light-mode, Telegram-native trading terminal: live charts, trade history, route aggregation with
platform fees, cross-chain launchpad analytics, a multi-wallet bundler and an AI trading copilot.

## Features

| Area | What you get | Where |
| --- | --- | --- |
| **Markets** | Token grid (StonkFun-style cards), pair-type filters, live stock/commodity ticker (Pyth) | `/` |
| **Token page** | Candlestick chart (1m–1D, price/market-cap toggle), trade history, holders, paired-asset valuation + dividend yield, pool backing | `/token/[address]` |
| **Trading** | Buy/sell with TON, USDT, $GRAM or USDC; compares STON.fi, DeDust, split and Omniston/cross-chain routes; signs via TON Connect | `TradePanel` |
| **Launch** | 3-step wizard: details → pair asset → liquidity. Deploys a jetton via `BitpadFactory`, then seeds a STON.fi v2 pool with both sides in one request | `/launch` |
| **Analytics** | Launchpad & DEX comparison (pump.fun, letsBONK, StonkFun, Pons, Four.meme, Clanker/Zora, Blum, STON.fi, DeDust, Uniswap, PumpSwap, Raydium, Aerodrome, PancakeSwap): volume, wins vs losses, avg/median return, FOMO index per chain, 14-day DEX volume, TON/ETH/SOL/stable/stock pair performance, cross-chain trending pools | `/analytics` |
| **Bundler** | Generate/import W5 burner wallets (encrypted in-browser), fund them in one TON Connect request, buy/sell from all at once with equal/random/weighted splits and staggering, sweep back | `/bundler` |
| **Portfolio** | TON + jetton holdings (TonAPI), allocation, Bitpad positions & dividend exposure, linked Solana/EVM wallets | `/portfolio` |
| **AI Copilot** | Claude-powered agent with tools over markets, analytics and the router; stages trades for you to sign — never executes | `/copilot` |
| **Revenue** | Swap fee (STON.fi referral, up to 1%), launch fee, configurable fee split | `/revenue` |
| **Auth** | Telegram Mini App (initData, auto sign-in), Telegram Login Widget, TON Connect, Solana (Phantom etc.), EVM (MetaMask etc.) | header |
| **Telegram bot** | `/start`, `/trending`, `/price SYMBOL` with an "Open Bitpad" Mini App button | `/api/telegram/webhook` |

## Stack

Next.js 16 (App Router) · React 19 · Tailwind CSS 4 · `@tonconnect/ui-react` · `@ton/ton` / `@ton/core` ·
`@ston-fi/sdk` + `@ston-fi/api` · lightweight-charts · Recharts · Zustand · `@anthropic-ai/sdk` · Tact contracts

## Getting started

```bash
npm install
cp .env.example .env.local   # fill in what you need (all optional for a local preview)
npm run dev                  # http://localhost:3000
npm test                     # compiles contracts + runs sandbox & unit tests
npm run build
```

### Configuration (`.env.example`)

| Variable | Needed for |
| --- | --- |
| `NEXT_PUBLIC_APP_URL` | TON Connect manifest, jetton metadata URIs, Telegram buttons |
| `NEXT_PUBLIC_FEE_WALLET`, `NEXT_PUBLIC_SWAP_FEE_BPS`, `NEXT_PUBLIC_LAUNCH_FEE_TON` | Platform revenue |
| `TELEGRAM_BOT_TOKEN`, `NEXT_PUBLIC_TELEGRAM_BOT`, `SESSION_SECRET` | Telegram login & Mini App |
| `NEXT_PUBLIC_BITPAD_FACTORY` | On-chain launches (without it `/launch` runs in preview mode) |
| `NEXT_PUBLIC_GRAM_JETTON`, `NEXT_PUBLIC_USDC_JETTON` | Paying with $GRAM / USDC on TON |
| `NEXT_PUBLIC_TONCENTER_API_KEY`, `TONAPI_KEY` | Higher RPC / indexer rate limits |
| `ANTHROPIC_API_KEY` | AI Copilot |

### Telegram Mini App

1. Create a bot with @BotFather, set `TELEGRAM_BOT_TOKEN` / `NEXT_PUBLIC_TELEGRAM_BOT`.
2. `/newapp` (or bot settings → Menu button) → point it at `NEXT_PUBLIC_APP_URL`.
3. `/setdomain` to your domain for the Login Widget.
4. Register the webhook:
   `curl "https://api.telegram.org/bot$TELEGRAM_BOT_TOKEN/setWebhook?url=$APP_URL/api/telegram/webhook&secret_token=$TELEGRAM_WEBHOOK_SECRET"`

### Contracts

See [`contracts/README.md`](contracts/README.md). `npm run contracts:build` compiles the Tact factory and
jetton; `contracts/tests` runs launch → mint → transfer and fee/permission checks in `@ton/sandbox`.
**Not audited** — test on testnet and audit before mainnet.

## Data sources & what is live

| Data | Source | Fallback |
| --- | --- | --- |
| Stock / commodity / crypto prices | Pyth Hermes | reference prices in `src/lib/assets.ts` |
| Launchpad & DEX volume, fees | DefiLlama | seeded preview numbers |
| Wins/losses, returns, FOMO, trending pools | GeckoTerminal (new + trending pools per chain) | seeded preview numbers |
| Swap quotes | STON.fi simulator (with referral fee) | depth-based estimate |
| Portfolio | TonAPI | — |
| **Bitpad token listings, candles, trades, holders** | **seeded preview data** (`src/lib/demo.ts`) | — |

Anything not live is labelled **Preview** in the UI. The Bitpad listings are placeholders until a launch indexer
(watching `BitpadFactory`'s `Launched` events and STON.fi pools) is connected — `src/lib/market.ts#getTokens`
is the single place to plug it in. Pons Family, StonkFun and Sender don't expose public APIs, so they show
preview numbers unless GeckoTerminal attributes pools to them.

## Branding

`public/logo.svg` is a **placeholder mark** — bitlievers.xyz wasn't reachable from the build environment. Drop the
official Bitlievers logo in at the same path (and regenerate `public/icon-180.png`). Colors are tokens at the top of
`src/app/globals.css`.

## Project layout

```
contracts/            Tact factory + TEP-74 jetton, sandbox tests
src/app/              pages + API routes (markets, token, quote, analytics, agent, auth, portfolio, telegram)
src/components/       UI (TokenCard, PriceChart, TradePanel, LaunchForm, BundlerView, analytics/…)
src/lib/              config, asset catalog, venues, analytics aggregator, routing, auth, agent
src/lib/data/         GeckoTerminal, DefiLlama, Pyth, TonAPI adapters
src/lib/ton/          TON Connect tx builders: swap, liquidity, launch, multi-wallet bundler
tests/                unit tests (Telegram auth, launch encoding ↔ contract ABI)
```
