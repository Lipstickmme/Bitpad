# Bitpad contracts (Tact)

| File | Purpose |
| --- | --- |
| `bitpad_factory.tact` | Receives `Launch`, deploys a `BitpadJetton`, mints 100% of supply to the creator, forwards the launch fee. |
| `jetton.tact` | Fixed-supply TEP-74 jetton minter + wallet. Minted exactly once by the factory. |
| `messages.tact` | Message & struct definitions. `Launch` opcode `0x42504c31` matches `src/lib/ton/launch.ts`. |

Launch flow:

1. Frontend sends `Launch` (TON Connect) → factory deploys the minter and mints supply to the creator.
2. Frontend detects the jetton in the creator's wallet and sends two STON.fi v2
   `provide_liquidity` messages (token side + paired asset side) → pool is live. No bonding curve.

## Build & deploy

```bash
npm create ton@latest bitpad-contracts -- --type tact-empty   # Blueprint project
cp *.tact bitpad-contracts/contracts/
cd bitpad-contracts && npx blueprint build BitpadFactory
npx blueprint run   # deploy with init(owner, feeWallet, launchFee)
```

Put the deployed address in `NEXT_PUBLIC_BITPAD_FACTORY`.

> ⚠️ These contracts have not been compiled in this repo's CI or audited. Compile, test on testnet
> (Blueprint sandbox tests for launch → mint → transfer → burn), and get an audit before mainnet.
