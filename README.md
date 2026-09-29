# Bitpad

The lightweight TON launchpad for **paired tokens**. Launch a jetton paired with TON, USDT, $GRAM, gold or a
tokenized stock, and put the liquidity **straight into a STON.fi pool** — no bonding curve, no graduation.
Telegram-native trading terminal with live charts, trades, holders, route comparison with platform fees,
cross-chain launchpad analytics and a multi-wallet bundler.

**No sample data anywhere.** Every number comes from a free public API or the chain. When every source for a
value fails, the UI shows "—" or an explicit "unavailable" message instead of inventing it.

## What works right away (no deploy, no keys)

| Feature | Works with | Notes |
| --- | --- | --- |
| TON markets list | GeckoTerminal → STON.fi | top pools by volume, filter by pair type |
| Any TON token page | TonAPI / toncenter / STON.fi (meta), GeckoTerminal / DexScreener (pools) | open `/token/<jetton address>` or search |
| Candlestick chart | GeckoTerminal OHLCV → TonAPI price history | refreshes every 15s |
| Trade history | GeckoTerminal trades → STON.fi operations | refreshes every 15s |
| Holders | TonAPI → toncenter v3 | |
| **Buy / sell any TON jetton** | STON.fi v2 + DeDust v2 via TON Connect | real quotes; pay with TON, USDT, $GRAM, USDC |
| Platform fee on trades | Bitpad pools: on-chain · STON.fi referral / DeDust transfer | fee wallet read from the factory |
| Stock / gold / crypto prices | Pyth → Yahoo → Jupiter / CoinGecko | real 24h change |
| Dividend yield (TTM) | Yahoo Finance dividend history | |
| Analytics dashboard | GeckoTerminal (→ DexScreener) + DefiLlama | volume, wins/losses, FOMO, 14-day history |
| Multi-wallet bundler | TON Connect + toncenter | generate/fund/buy/sell/sweep |
| Portfolio | TonAPI + Solana & EVM public RPCs | TON jettons, SOL, ETH/Base, BNB |
| Search | STON.fi asset list | name, ticker or address |
| Revenue page | TonAPI events on the fee wallet | TON actually received + the on-chain fee/referral model |
| Login | TON Connect, Solana, EVM | Telegram needs `TELEGRAM_BOT_TOKEN` |

## Configuration

**No environment variables are required.** The deployed contracts are public addresses in `src/lib/config.ts`:

| Constant | Mainnet |
| --- | --- |
| `FACTORY_ADDRESS` | `EQCZ9eHWHr6j00Fm3vcFW9kLIyZpPJ9284y7ZzIMQhx3wz1y` |
| `BUNDLER_ADDRESS` | `EQCRv-NxbhlN5A9FRne7HhVpq1weRKumxscL6334xu2-xVTY` |

Launch fee, trade fees, minimum liquidity, the fee wallet and the enabled pair assets are read from the factory
on-chain; the network follows the factory address.

Optional, server-only: `TONCENTER_API_KEY` (recommended for mainnet — @tonapibot), `TONAPI_KEY` (tonconsole.com),
`TELEGRAM_BOT_TOKEN` (Telegram login, Mini App and bot).

## Setup steps

| Item | How |
| --- | --- |
| **Deploy the contracts** | [`contracts/README.md`](contracts/README.md): `npm run deploy:factory`, `npm run deploy:bundler`, `npm run pair:add` |
| Telegram bot | @BotFather → token → `TELEGRAM_BOT_TOKEN` → redeploy → open `https://<site>/api/telegram/setup` once (sets webhook + Mini App button). `/setdomain` in @BotFather enables the web login widget. |
| Brand | replace `public/brand/logo.svg`, `public/icon-180.png`; edit `src/brand.css` |

## Free data sources & fallback chains

| Data | Primary | Fallbacks |
| --- | --- | --- |
| TON market list | GeckoTerminal top + trending pools | STON.fi `/pools` + `/assets` |
| Jetton metadata | TonAPI `/jettons/{addr}` | toncenter v3 `/jetton/masters` → STON.fi asset |
| Token pools / price / volume | GeckoTerminal `/tokens/{addr}/pools` | DexScreener `/tokens/v1/ton/{addr}` → STON.fi price |
| Candles | GeckoTerminal OHLCV | TonAPI `/rates/chart` |
| Trades | GeckoTerminal pool trades | STON.fi operations API |
| Holders | TonAPI `/jettons/{addr}/holders` | toncenter v3 `/jetton/wallets` |
| Bitpad launches | Factory get-methods via toncenter | — (on-chain) |
| Launch market data | DexScreener (30 tokens/call) | GeckoTerminal `/tokens/multi` → STON.fi |
| Stocks | Pyth Hermes | Yahoo Finance chart → Jupiter (xStock token price) |
| Dividends | Yahoo Finance dividend events | — |
| Gold / silver / oil | Pyth | CoinGecko → Yahoo futures |
| Crypto majors | Pyth | CoinGecko |
| TON jetton prices | STON.fi | TonAPI rates → CoinGecko |
| Asset resolution | STON.fi asset list (TON jettons), Jupiter (Solana xStock mints) | — |
| Swap quotes | STON.fi simulator | DeDust on-chain `get_estimated_swap_out` |
| Launchpad / DEX volume & fees | DefiLlama | sampled pool volume |
| Wins / losses / FOMO | GeckoTerminal new + trending pools | DexScreener boosted tokens |
| Balances | TonAPI | Solana & EVM public RPCs (publicnode) |

All free, no signup. Hosts the server needs to reach: `api.geckoterminal.com`, `api.dexscreener.com`, `api.ston.fi`,
`tonapi.io`, `toncenter.com`, `hermes.pyth.network`, `query1.finance.yahoo.com`, `api.coingecko.com`,
`lite-api.jup.ag`, `api.llama.fi`, `api.mainnet-beta.solana.com`, `*.publicnode.com`, `api.telegram.org`.

## Getting started

```bash
npm install
cp .env.example .env.local
npm run dev          # http://localhost:3000
npm test             # contracts (sandbox) + auth + parser tests
npm run build
```

## Limits worth knowing

- **Cross-chain buys**: trades execute on TON. For stock pairs whose asset lives on Solana (xStocks), the token page
  links to Jupiter with the real mint. A Bitpad pool can only be seeded against a paired asset that exists as a TON jetton
  (TON, USDT, $GRAM, bridged XAUt, etc.); the launch form tells you when it doesn't.
- **Free tiers are rate-limited** (GeckoTerminal ≈30/min, toncenter/TonAPI ≈1 rps keyless). Responses are cached
  (15s–10min); add the free keys above for real traffic.
- **Yahoo Finance** is an unofficial endpoint; Pyth and Jupiter cover stock prices if it changes.

## Layout

```
contracts/            Tact: factory, jetton, pool (locked-liquidity AMM), bundler + sandbox tests
scripts/              deploy-factory.ts, deploy-bundler.ts, add-pair.ts
src/brand.css         brand tokens (colors / font) — the one file to re-skin
src/app/              pages + API routes
src/components/       UI
src/lib/data/         adapters: gecko, dexscreener, stonfi, tonapi, toncenter, pyth, yahoo, coingecko, jupiter, llama, rpc
src/lib/              market (tokens, candles, trades, holders), prices, launches (factory indexer), analytics, routing, fees, auth
src/lib/ton/          TON Connect builders: STON.fi swap, DeDust swap, pool seeding, launch, multi-wallet bundler
tests/                unit tests with API fixtures
```
