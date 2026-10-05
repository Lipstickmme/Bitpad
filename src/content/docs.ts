import { BUNDLER_ADDRESS, FACTORY_ADDRESS, LEGACY_FACTORIES, config } from "@/lib/config";

/**
 * Bitpad docs, GitBook style: grouped pages written in a small Markdown
 * dialect (see components/docs/Markdown.tsx): ## / ### headings, lists,
 * tables, `code`, **bold**, [links](/x), ``` blocks and callouts
 * (> [!INFO] / [!TIP] / [!WARN] on the first line of a quote).
 */
export interface DocPage {
  slug: string;
  group: string;
  title: string;
  description: string;
  body: string;
}

const fee = (config.swapFeeBps / 100).toFixed(2);
const refShare = config.referral.referrerShareOfCreatorFee;
const links = config.referral.maxLinksPerToken;

export const DOCS: DocPage[] = [
  {
    slug: "introduction",
    group: "Getting started",
    title: "What is Bitpad?",
    description: "Buy tokenized stocks and assets on TON, and launch creator jettons backed by them.",
    body: `
Bitpad does two things on TON:

> [!INFO]
> TON's native coin was renamed from Toncoin (TON) to **Gram (GRAM)** on 15 June 2026. Same coin, new ticker; the network is still called TON. Bitpad shows GRAM everywhere.

1. **Buy tokenized stocks and assets.** Apple, Tesla, NVIDIA, the S&P 500, gold and more, as jettons you hold in your own wallet, alongside every TON token and trending coins on Solana and EVM chains.
2. **Launch creator jettons.** Your own coin, backed by a stock, a commodity, a jetton or another creator's jetton. Its pool is live from the first block, the liquidity is locked forever, and you earn on every trade.

> [!INFO]
> Everything that matters happens on-chain: launches, pools, fees, referral splits and staking rewards are enforced by Bitpad's smart contracts, and every number on the site is read from the chain.

## Why creator jettons?

Most launchpads start a token on a bonding curve and "graduate" it to a DEX later. Early buyers become exit liquidity, and the launch depends on hitting a target.

On Bitpad there is no curve and no graduation. When you launch, you deposit real liquidity of the asset you chose (say, $2,000 of SPYx), and the pool exists from block one. Your jetton's price moves against something real, so a creator jetton backed by the S&P 500 or by gold starts with a real reserve behind it.

## What you can do

| | |
| --- | --- |
| [Launch a creator jetton](/docs/launch) | One transaction: token, pool and locked liquidity |
| [Buy tokens and stocks](/docs/trading) | ⚡ quick buy on the best route, in GRAM |
| [Earn with referral links](/docs/referrals) | Share of fees for every buyer you bring |
| [Stake and earn GRAM](/docs/staking) | Holders earn a cut of every launch's fees |
| [Chat on-chain](/docs/trench-chat) | Calls, theses and replies, written to TON |
`,
  },
  {
    slug: "quick-start",
    group: "Getting started",
    title: "Quick start",
    description: "Connect a wallet, log in with Telegram, and make your first buy.",
    body: `
## 1. Connect a TON wallet

Press **Connect** (top right) and choose Tonkeeper, Telegram Wallet, MyTonWallet or any TON Connect wallet. Bitpad never holds your keys: every transaction is built in the app and signed in your wallet.

> [!TIP]
> If a transaction keeps waiting, open your wallet app. When nothing shows up there, the wallet link has gone stale: use **Reconnect wallet** in the message that appears, then try again.

## 2. Log in with Telegram (recommended)

Press **Log in with Telegram** in the Connect menu. Telegram opens a chat with the Bitpad bot: press Start, then tap **Log in to Bitpad**. Logging in links your Telegram account. It lets you launch a **verified** creator jetton, shows your name in the app, and works automatically inside the Telegram Mini App.

## 3. Add Solana or EVM wallets (optional)

To buy trending coins on other chains, connect Phantom (Solana) or MetaMask (Ethereum, Base, BSC, Arbitrum, Polygon, Avalanche) from the same menu.

## 4. Make your first buy

Set your quick-buy amount in GRAM at the top of any list, then press ⚡ next to a token. Bitpad finds a live route, shows what you'll get, and your wallet asks you to approve.
`,
  },
  {
    slug: "launch",
    group: "Creator jettons",
    title: "Launch a creator jetton",
    description: "Token, pool and locked liquidity in a single transaction.",
    body: `
Every jetton launched on Bitpad is a **creator jetton**: a creator's own coin with a pool against a backing asset, referral links and holder staking built in.

## Steps

1. Open [Launch Creator Jetton](/launch). If you're logged in with Telegram, your name, ticker and Telegram link are filled in for you.
2. **Token details:** name, ticker (2–10 letters or digits), image URL, description and socials.
3. **Back it with:** pick a stock, commodity, jetton, cross-chain asset or another creator's jetton. See [Backing assets](/docs/backing).
4. **Liquidity:** choose the total supply, how much of it goes into the pool (50–100%) and how much of the backing asset you deposit (in USD).
5. Press **Launch creator jetton** and approve once in your wallet.

## What happens on-chain

One transaction to the Bitpad factory:

- deploys your jetton with a **fixed supply**, minted exactly once and never mintable again;
- deploys its pool and locks your liquidity in it. There are **no LP tokens and no withdraw path**, so nobody (including you) can pull the pool;
- sends the creator share (up to 20% of supply) to your wallet;
- deploys a staking vault for holders;
- opens trading immediately.

Within a minute your token page opens. Add referral links there.

## Starting price

The starting price is simply your deposit divided by the tokens in the pool:

\`\`\`
start price = deposit (USD) ÷ tokens in pool
market cap  = start price × total supply
\`\`\`

The preview on the launch page shows both before you sign.

## Costs

| Item | Amount |
| --- | --- |
| Launch fee | Set in the factory contract, shown on the launch page |
| Network gas | About 0.5 GRAM (unused gas is returned) |
| Liquidity | What you choose; it stays in the pool |

> [!WARN]
> Liquidity is locked forever. Only deposit what you intend to keep in the market.
`,
  },
  {
    slug: "backing",
    group: "Creator jettons",
    title: "Backing assets",
    description: "Stocks, commodities, jettons, bridged assets and other creators.",
    body: `
The asset you choose is the other side of your pool: buyers pay in it and sellers receive it. Your jetton's price is quoted in it on-chain.

| Category | Examples |
| --- | --- |
| Stocks & ETFs | SPYx, QQQx, AAPLx, NVDAx, TSLAx, GOOGLx, METAx, MSFTx, AMZNx, MSTRx, COINx, HOODx, KOx |
| Commodities | XAUt (Tether Gold) |
| TON jettons | GRAM (native coin), USDT, NOT, DOGS, STON |
| Cross-chain | Bridged BTC (tgBTC, jWBTC), ETH (jWETH), USDC, USDe, BNB, TRX, DOGE |
| Creator jettons | Any creator jetton the factory has enabled as a pair |

## Enabled pairs

GRAM (the native coin) works for everyone. A jetton can back a launch only once it's **registered and enabled in the factory**, so a launch can't be pointed at a fake token. The launch page marks which assets are enabled. If you pick one that isn't, the launch button tells you.

## Backing with another creator

When a creator jetton is enabled as a pair, new creator jettons can be backed by it. Every buy of those jettons runs through the original creator's coin, so communities can build on each other.

## Stocks: what you actually hold

xStocks are issued by Backed Finance. Each token is backed 1:1 by the real share, held by a regulated custodian, and dividends are reinvested into the token. They aren't available to US persons.
`,
  },
  {
    slug: "verified",
    group: "Creator jettons",
    title: "Verified creators",
    description: "How the ✓ badge links a jetton to a Telegram account.",
    body: `
When you launch while logged in with Telegram, Bitpad signs three things together: **your Telegram account, the wallet you launch from and your ticker**. The signature is stored in your jetton's metadata.

Anyone viewing the jetton can then check it:

- the signature must match the Telegram account named in the metadata;
- the wallet must be the one the factory recorded on-chain as the creator;
- the ticker must match.

If any of these differ (for example someone copies your proof into their own launch), the badge doesn't show.

> [!INFO]
> You need a Telegram **username** for the badge. Set one in Telegram settings, then log in again.

Launches made without Telegram still work. They show as **unverified**.
`,
  },
  {
    slug: "referrals",
    group: "Creator jettons",
    title: "Referral links",
    description: `Up to ${links} links per token, ${refShare}% of the creator fee to the referrer.`,
    body: `
Each creator jetton has its own referral system, built into its pool contract.

- The creator registers up to **${links} referral links** (wallet addresses) on the token page.
- Every buy goes through a link: a referrer's, or the creator's own.
- On each trade the **creator fee is split ${100 - refShare}/${refShare}** between the creator and the referrer whose link was used.
- Referrers claim their share any time from the token page. It accrues in the pool, on-chain.

Share a link by copying it from the token page. Anyone who opens it and buys pays the referrer automatically.

## The general referral program

Separate from per-token links, every logged-in user gets a personal link that works across the whole app. See [General referrals](/docs/general-referrals).
`,
  },
  {
    slug: "staking",
    group: "Creator jettons",
    title: "Holder staking",
    description: "Stake a creator jetton, earn GRAM from its fees.",
    body: `
Every creator jetton launched on the current factory has its own **staking vault**.

- Stake by sending the jetton to the vault from the token page. Unstake any amount, any time.
- **30% of the protocol fee and 30% of the creator's fee** from every trade go to the vault when fees are claimed.
- Rewards are paid in **GRAM**, split pro-rata to what's staked at that moment.

GRAM-backed pools pay the vault directly. Pools backed by a jetton send the stakers' share to the fee wallet, which converts it to GRAM and tops the vault up.
`,
  },
  {
    slug: "trading",
    group: "Trading",
    title: "Buying and selling",
    description: "Quick buy, the trade panel, routes and slippage.",
    body: `
## ⚡ Quick buy

Set an amount once at the top of a list, then press ⚡ next to any token. Bitpad quotes it live and builds the transaction in one step, and your wallet opens to approve.

- **Currency:** GRAM, TON's native coin (renamed from Toncoin).
- **No pool in GRAM?** Some tokens trade against USDT only. Bitpad then re-quotes the same dollar value in USDT and tells you. Stocks without pools go through Omniston, and if your amount is below what market makers quote, Bitpad offers their minimum for you to approve.
- **Slippage:** set in the settings. If the price moves more than that before your swap lands, it refunds instead of filling.

## Routes

| Token | Route |
| --- | --- |
| Creator jettons | Their Bitpad pool, directly |
| Other TON tokens | STON.fi or DeDust, whichever gives more |
| Tokenized stocks (xStocks) | STON.fi Omniston, which gets quotes from market makers (xStocks have no regular pools) |
| Solana / EVM tokens | LI.FI's best route, paid from Phantom or MetaMask |

## The trade panel

On a token page you can compare routes, pick the pay asset, and buy or sell any amount.
`,
  },
  {
    slug: "stocks",
    group: "Trading",
    title: "Stocks, metals and Bitcoin",
    description: "Verified tokenized stocks, metals and crypto majors on TON and other chains, price gaps and dividends.",
    body: `
## What you can buy

The [Stocks](/stocks) page has three tabs:

| Tab | What's in it |
| --- | --- |
| **Stocks** | Tokenized US shares and ETFs, filtered by theme: **AI** (NVIDIA, Palantir, AMD, Broadcom, Oracle…), **Meme** (GameStop, Opendoor), **Innovation** (Eli Lilly, Novo Nordisk, Tesla…), **Popular**, **Index** (S&P 500, Nasdaq 100) and **Crypto-linked** (Strategy, Coinbase, Circle) |
| **Metals** | Gold (Tether Gold, the SPDR Gold ETF) and other metals with a verified token |
| **Bitcoin & majors** | BTC and ETH as verified tokens: tgBTC or jWBTC on TON, cbBTC or WBTC and WETH on Solana |

An asset only appears when a verified token for it exists. On TON you pay in GRAM; on Solana you pay in SOL from Phantom. More names (CoreWeave, Rocket Lab, IonQ, Moderna, Kinesis Silver…) show up under **On other chains** wherever a verified xStocks, Ondo or metals token trades.

> [!INFO]
> Some popular companies can't be listed because no verified token exists for them yet. Dangote Refinery, for example, is listing on the Nigerian Exchange: its IPO took subscriptions on-chain, but the shares themselves aren't tokenized or tradable as tokens. Once a genuine token exists, it can be added.

## The table

Each row shows:

- **Real price**: the Pyth oracle (Yahoo as a fallback), following the actual market.
- **On TON**: what the jetton trades for on STON.fi right now.
- **Gap**: the difference. Gaps usually widen when the US market is closed, because TON trades 24/7.
- **Dividend score and calendar**: who pays, how much, and estimated next payment dates. xStock holders don't receive cash: dividends are reinvested into the token. See [Dividends](/docs/dividends).

## Verified versions only

Tokenized stocks, gold and the majors (BTC, ETH, SOL and friends) attract copycats: tokens that borrow the ticker, sometimes with real liquidity behind them. Bitpad only lists and sells the genuine contract:

| Chain | Counts as verified |
| --- | --- |
| TON | STON.fi's canonical token for that ticker (or marked essential), with no risk tags |
| Solana | Verified on Jupiter, or listed on CoinGecko |
| Ethereum and other EVM chains | Listed on CoinGecko under the same ticker |

If an asset has no verified token on a chain, Bitpad doesn't sell it there. Where several verified tokens track the same asset on one chain (say xStocks and Ondo, or tgBTC and jWBTC on TON), only one is listed: the most liquid, which is the cheapest to buy.

## On other chains

Below that, tokenized stocks and gold on Solana and EVM chains (xStocks, Ondo, PAX Gold, Tether Gold) are listed with liquidity and volume, plus popular tokens that trade against them (only tokens paired with the verified version). ⚡ buys them with that chain's coin.

## Market tables

- **Verified first.** In the TON, Ethereum and Solana markets, verified tokens (blue check) are listed above the rest.
- **OG grade.** A token shows one badge, never two. Verified tokens get the blue check. Unverified tokens that have traded for a year or more get a gold **OG** badge instead, as a nod that they've survived: ★ 1+ year, ★★ 2+ years, ★★★ 3+ years, counted from their oldest pool.
- **Holders.** The number of wallets holding each token, from TonAPI on TON, Jupiter on Solana, and Ethplorer or GeckoTerminal on EVM chains.
- **Stock pairs first.** On Ethereum and Solana the first tab is tokenized stocks and the tokens paired with them, then trending and top pools.

Every stock and pool opens a chart page.
`,
  },
  {
    slug: "dividends",
    group: "Trading",
    title: "Dividends",
    description: "Which assets earn dividends, how xStocks pay them on TON, and what that means for creator jettons backed by stocks.",
    body: `
Short version: **tokenized stocks earn dividends, nothing else does**, and on TON they arrive without you doing anything.

## Dividend score

Every stock and pair asset carries a dividend score, live from each company's last 12 months of payouts:

| Score | Means |
| --- | --- |
| **High** (3 bars) | Yield of 3% a year or more |
| **Medium** (2 bars) | 1% to 3% |
| **Low** (1 bar) | Under 1% (a token payout, e.g. NVIDIA) |
| **No dividend** (0 bars) | Doesn't pay one (Tesla, Amazon, Coinbase, Robinhood, Strategy, gold, crypto) |
| **Staking** | No dividend, but there's a separate way to earn (GRAM, creator jettons) |

You'll see it on the [Stocks](/stocks) page, each stock's page, the stock cards on Markets and the asset picker when you launch. Hover it for details. Companies change their payouts, so the badge is live and the names above are only examples.

## How xStocks pay dividends on TON

xStocks (by Backed Finance) **don't pay cash**. When a company pays a dividend, Backed reinvests it, after US withholding tax, into more of the same share, and raises the token's **multiplier**.

- On TON, xStocks are scaled UI jettons (TEP-526). Your on-chain balance never changes, and the multiplier lives in the token's metadata.
- What one token is worth = one share × multiplier. If the multiplier goes from 1.00 to 1.01, every token you hold is now worth 1% more stock.
- Wallets that read the multiplier show a slightly bigger balance. Wallets that don't still show the old number, but the value is there either way, because the token's price already includes it.
- **Nothing to claim, no snapshot, no sign-up.** You get it wherever the token sits: your wallet, a bundler wallet, or inside a pool.

> [!INFO]
> This is why xStocks on TON often trade a little above the "Real price" on the Stocks page. Real price is one share, while one xStock is one share plus the dividends reinvested so far. A small, steady premium is normal.

## Other assets

| Asset | Dividend? |
| --- | --- |
| xStocks on TON, Solana and Ethereum | Yes, same multiplier on every chain |
| Gold, silver, oil (XAUt, XAG, WTI) | No. Tracks the metal or commodity price only |
| GRAM | No. You can stake it with a validator or liquid-staking pool, outside Bitpad |
| ETH, SOL | No. Staking yield exists on those chains, outside Bitpad |
| BTC, memecoins, other jettons | No |
| Stablecoins (USDT, USDC, USDe) | Not by themselves. Any yield comes from separate products |
| Other issuers' tokenized stocks | Depends on the issuer. Check their terms |

## Creator jettons backed by a stock

Holders of a creator jetton **don't receive dividends directly**: a creator jetton is not a share. But a stock-backed jetton gets a slow tailwind from them:

1. The token's pool holds the stock (say SPYx) as its reserve.
2. When SPY pays a dividend, the SPYx multiplier rises, so every SPYx in the reserve is worth a bit more.
3. Your jetton's price is set in SPYx, so in dollars it rises by the same few percent a year, even with no trading.

So backing with a **High** or **Medium** asset (Coca-Cola, the S&P 500) adds a small, steady lift on top of the stock's own price moves. A **No dividend** asset (Tesla, gold) moves with its price only.

Holders can also [stake](/docs/staking) in the token's vault to earn a share of its trading fees. That's the creator jetton's own payout, separate from dividends.

> [!WARN]
> Dividends are small next to price moves. A 2% yield doesn't protect you from a 20% drop in the stock or the jetton. Pairing a token with a stock gives no claim on the company or its dividends beyond what the pool holds.
`,
  },
  {
    slug: "cross-chain",
    group: "Trading",
    title: "Cross-chain buys",
    description: "Buy on Solana and EVM chains without leaving Bitpad.",
    body: `
Trending pools on Solana, Ethereum, Base, BSC, Arbitrum, Polygon and Avalanche can be bought from Bitpad through LI.FI.

1. Connect Phantom (Solana) or MetaMask (EVM).
2. Press ⚡. The quick-buy amount is converted to its dollar value and paid in the chain's coin (SOL, ETH, BNB, POL, AVAX).
3. Bitpad checks your balance covers the buy plus fees **before** asking you to sign, and only reports success once the chain confirms.

> [!INFO]
> EVM transactions are only sent to LI.FI's official contract. Anything else is refused.
`,
  },
  {
    slug: "bundler",
    group: "Trading",
    title: "Bundler",
    description: "Buy into many wallets in one transaction.",
    body: `
The [Bundler](/bundler) buys a token into up to **100 wallets** in one transaction through the on-chain Bitpad bundler contract, so a launch can be spread across wallets from the first block.

It's open to everyone, and every bundle is visible on-chain.
`,
  },
  {
    slug: "trench-chat",
    group: "Community",
    title: "Trench Chat",
    description: "Free off-chain chat with Telegram, or on-chain messages for calls and likes.",
    body: `
Trench Chat is Bitpad's live chat. Open it from the bubble at the bottom of any page. Every message carries a label saying where it's stored.

| | Off-chain | On-chain |
| --- | --- | --- |
| Cost | Free | About 0.01 GRAM per message, gas included |
| Needs | Telegram login | A TON wallet |
| Stored | Bitpad's public Telegram channel, posted by the Bitpad bot | TON blockchain, Bitpad's chat contract |
| Can do | Text, emojis, stickers, GIFs, replies | All of that plus likes, calls and tiny images |

- **Ticker lookup:** write a $TICKER and it links to that token's page.
- **Calls:** a call is a thesis on a jetton, and only wallets that hold it can post one. The ✓ holder badge is re-checked against current balances.
- **Replies:** you can reply to any message. Replies to off-chain messages are off-chain too.

On-chain messages can't be edited or deleted. Off-chain messages live in the Telegram channel and are moderated there.
`,
  },
  {
    slug: "general-referrals",
    group: "Community",
    title: "General referrals",
    description: "Earn 20% of the platform fees from everyone you bring.",
    body: `
Every logged-in user has a personal referral link (see [Revenue](/revenue)). When someone opens Bitpad through it, every buy they make through a routed swap carries your address in its fee transfer.

- You earn **20% of the platform fee** on those buys.
- Each fee transfer is tagged on-chain with your address, so your earnings can be checked by anyone.
- Your referrals, earnings and payout history are on the Revenue page.

This works on top of per-token [referral links](/docs/referrals).
`,
  },
  {
    slug: "fees",
    group: "Platform",
    title: "Fees and revenue",
    description: "What every trade pays, and where it goes. All on-chain.",
    body: `
Bitpad is transparent about what it earns and what it shares. Every fee is enforced by a contract or written into a transfer on-chain, and the [Revenue](/revenue) page reads the totals live from the chain.

| Where you trade | Fee | Where it goes |
| --- | --- | --- |
| Creator jetton pools | Protocol + creator fee, set in the factory | Protocol fee to Bitpad; creator fee split with the referrer; 30% of both to holder staking |
| STON.fi routes | ${fee}% | STON.fi referral vault owned by Bitpad's fee wallet |
| DeDust routes | ${fee}% | A separate, tagged fee transfer |
| Solana / EVM (LI.FI) | Integrator fee | Collected by LI.FI for Bitpad |

General referrers receive 20% of the platform fee on the buys they bring.

## Launch fee

Paid once per launch, set in the factory contract and shown on the launch page before you sign.
`,
  },
  {
    slug: "analytics",
    group: "Platform",
    title: "Analytics",
    description: "Launchpads, DEXes and chains compared, with top-3 boards.",
    body: `
[Analytics](/analytics) compares launchpads and DEXes across TON, Solana, Ethereum, Base, BSC, Arbitrum, Polygon, Avalanche, Sui and Tron:

- volume, growth, fees, win rate, median return, buy pressure and launches per venue;
- top-3 boards for every metric, for venues, chains and pools;
- which kind of pair (GRAM, ETH, SOL, stables, stocks) is drawing money today;
- trending pools you can open as charts and buy.

Data comes from GeckoTerminal, DexScreener and DefiLlama. When a source doesn't answer, the panel says so instead of guessing.
`,
  },
  {
    slug: "contracts",
    group: "Platform",
    title: "Contracts and security",
    description: "Addresses, guarantees and what Bitpad can and can't do.",
    body: `
## Addresses (TON mainnet)

| Contract | Address |
| --- | --- |
| BitpadFactory | \`${FACTORY_ADDRESS}\` |
| BitpadBundler | \`${BUNDLER_ADDRESS}\` |
${LEGACY_FACTORIES.map((f) => `| Earlier factory | \`${f}\` |`).join("\n")}

## Guarantees enforced by the contracts

- **Fixed supply.** Each jetton is minted once at launch and can never be minted again.
- **Locked liquidity.** Pools have no LP tokens and no withdraw function.
- **Refund on failure.** Any swap or launch that can't be honoured (slippage, bad payload, unregistered pair) is refunded.
- **Fees capped.** The factory can't set protocol + creator fees above 10%.

## What Bitpad's owner can do

- register and enable pair assets;
- change the launch fee and the fees for **future** launches;
- change the fee wallet.

The owner can't move liquidity, mint tokens or touch staked funds.

## Your keys

Bitpad never sees your keys. Transactions are built in the app and signed in your own wallet.
`,
  },
  {
    slug: "portfolio",
    group: "Trading",
    title: "Portfolio and history",
    description: "Holdings on TON, Solana, Ethereum and Base, and every transaction you've made.",
    body: `
[Portfolio](/portfolio) shows every wallet you've connected: TON through TON Connect, Solana through Phantom (or Solflare, Backpack), and EVM through MetaMask (or Rabby, Coinbase Wallet).

## Holdings

| Tab | What's listed | Source |
| --- | --- | --- |
| TON | GRAM and every jetton | TonAPI |
| Solana | SOL and every SPL / Token-2022 token, xStocks included | the Solana network, priced by Jupiter |
| Ethereum & Base | ETH and every ERC-20 | Blockscout |

Tokens with no market price are hidden by default (they're usually airdropped spam); tick the box under the table to show them. Net worth adds up all chains.

## Transaction history

The history merges two things:

- **On-chain history** of each connected wallet: swaps, transfers and contract calls, with what came in (+) and went out (−), its status and a link to the explorer (Tonviewer, Solscan, Etherscan, Basescan).
- **Bitpad's own log** of everything you sent from the app: ⚡ buys, sells, launches, staking, referral claims, chat posts, bundler trades and funding, and cross-chain buys on Solana or EVM. These rows carry a **Bitpad** tag and say what you did ("⚡ Buy $TSLAx"), even when the explorer only shows a contract call.

Filter by chain or **Made on Bitpad**, and press **CSV** to download the list for your records or taxes.

> [!INFO]
> Bitpad's log is stored in this browser only, so it doesn't follow you to another device and clearing site data erases it. Export a CSV now and then to keep a copy. On-chain history is always re-read from the chain.
`,
  },
  {
    slug: "faq",
    group: "Platform",
    title: "FAQ",
    description: "Common questions.",
    body: `
### My wallet keeps waiting

Open your wallet app and look for the request. If it isn't there, the wallet link is stale: press **Reconnect wallet** in the message that appears and try again.

### "No live route" when buying a stock

Most xStocks have no regular pools on TON; market makers quote them through STON.fi's Omniston aggregator, and Bitpad uses it automatically. If no market maker is quoting right now, try another amount or try again shortly, or use the **Buy on STON.fi** button.

### Can I remove liquidity from my launch?

No. Liquidity is locked forever. That's what makes a creator jetton safe to buy.

### Why is my creator jetton unverified?

It was launched without a Telegram login, or your Telegram account had no username at the time.

### Are xStocks available in the US?

No. xStocks aren't offered to US persons, and STON.fi may check eligibility.
`,
  },
];

export const DOC_GROUPS = [...new Set(DOCS.map((d) => d.group))];
export const docBySlug = (slug: string) => DOCS.find((d) => d.slug === slug);
