# Bitpad contracts (Tact)

**Only one contract needs deploying: `BitpadFactory`.** Everything else is either deployed by the
factory (each launch's jetton), or already live on mainnet (STON.fi / DeDust pools, routers, vaults).

| File | Purpose |
| --- | --- |
| `bitpad_factory.tact` | Receives `Launch`, deploys a `BitpadJetton`, mints 100% of supply to the creator, forwards the launch fee to the fee wallet, and records the minter in an on-chain registry (`launch_count`, `minter(i)`) that the app indexes. |
| `jetton.tact` | Fixed-supply TEP-74 jetton minter + wallet. Minted exactly once by the factory, then non-mintable. `bitpad_info` exposes creator + pair. |
| `messages.tact` | Message & struct definitions. `Launch` opcode `0x42504c31` matches `src/lib/ton/launch.ts`. |

## What is and isn't a contract

| Feature | On-chain piece | Deploy needed? |
| --- | --- | --- |
| Token launches | `BitpadFactory` → `BitpadJetton` per launch | **Yes — the factory, once** |
| Pools / liquidity | STON.fi v2 router creates the pool on first `provide_liquidity` | No |
| Swaps | STON.fi v2 routers, DeDust v2 vaults | No |
| Platform swap fee | STON.fi referral (paid inside the swap) · DeDust: extra transfer in the same request | No |
| Launch fee | Forwarded by the factory | No (part of the factory) |
| Multi-wallet bundles | Standard W5 wallets, created in the browser | No |
| Fee split / buybacks | Distributed from the fee wallet | No (optional later: a splitter contract) |

## Deploy

```bash
npm install
npm test                                # compiles + runs sandbox tests

# 1) testnet first — get test TON from @testgiver_ton_bot
DEPLOYER_MNEMONIC="w1 … w24" NETWORK=testnet FEE_WALLET=<your fee wallet> LAUNCH_FEE_TON=1 \
  npm run deploy:factory

# 2) mainnet (needs ~0.6 TON on the deployer wallet)
DEPLOYER_MNEMONIC="w1 … w24" NETWORK=mainnet FEE_WALLET=<your fee wallet> LAUNCH_FEE_TON=1 \
  TONCENTER_API_KEY=<free key from @tonapibot> npm run deploy:factory
```

The script prints `NEXT_PUBLIC_BITPAD_FACTORY=…` — put it in your env (and `NEXT_PUBLIC_TON_NETWORK=testnet`
while testing). The deployer wallet becomes the factory owner and can later change the fee
(`SetLaunchFee`) or fee wallet (`SetFeeWallet`). Use `WALLET_VERSION=v4` if your mnemonic is a v4 wallet.

> ⚠️ Not audited. Launch a couple of tokens on testnet end-to-end (launch → seed pool → buy/sell)
> and get an audit before putting real value through it.
