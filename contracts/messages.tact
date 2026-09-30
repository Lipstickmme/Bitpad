// ═══════════════════════════════════════════════════════════════════════════
//  Bitpad messages & structs
//  Opcodes are explicit so the frontend (src/lib/ton/*) can build bodies.
// ═══════════════════════════════════════════════════════════════════════════

// ── Pair-asset kinds (informational; stored in the registry) ──────────────
const PAIR_KIND_NATIVE: Int = 0;    // TON
const PAIR_KIND_STABLE: Int = 1;    // USDT, USDC
const PAIR_KIND_JETTON: Int = 2;    // GRAM, NOT, …
const PAIR_KIND_STOCK: Int = 3;     // tokenized equities bridged to TON
const PAIR_KIND_COMMODITY: Int = 4; // XAUt, …
const PAIR_KIND_CRYPTO: Int = 5;    // bridged BTC / ETH, …

/// Registry entry for a jetton that tokens may be paired with.
struct PairInfo {
    symbol: String;
    decimals: Int as uint8;
    kind: Int as uint8;
    /// Pyth price-feed id for the asset's USD price (0 = none). Lets any
    /// indexer/frontend derive USD prices from the on-chain pool price.
    pythFeedId: Int as uint256;
    /// Minimum initial liquidity (raw jetton units) for a launch
    minLiquidity: Int as coins;
    /// The factory's own jetton wallet for this asset (discovered via TEP-89)
    wallet: Address?;
    enabled: Bool;
}

// ── Factory: launches ─────────────────────────────────────────────────────

/// Launch paired with native TON. Attach: launchFee + pairAmount + LAUNCH_GAS.
message(0x42504c31) Launch {
    queryId: Int as uint64;
    supply: Int as coins;          // raw units (supply × 10^9)
    creatorBps: Int as uint16;     // share of supply kept by the creator (0–2000 = 0–20%)
    pairAmount: Int as coins;      // TON (nanoTON) to lock in the pool
    content: Cell;                 // TEP-64 content (0x01 + URI)
}

/// Launch paired with a registered jetton: sent as the forward_payload of a
/// jetton transfer to the factory. forward_ton_amount must cover launchFee + gas.
message(0x42504c36) LaunchWithJetton {
    supply: Int as coins;
    creatorBps: Int as uint16;
    content: Cell;
}

/// Pool → factory: pair-jetton wallet discovered, send the initial liquidity.
message(0x42504c37) PoolReady {
    index: Int as uint64;
}

message(0x42504c35) Launched {
    index: Int as uint64;
    minter: Address;
    pool: Address;
    creator: Address;
    supply: Int as coins;
    pair: Address?;               // null = TON
    pairAmount: Int as coins;
}

// ── Factory: admin ────────────────────────────────────────────────────────
message(0x42504c40) AddPair {
    master: Address;
    info: PairInfo;
}
message(0x42504c41) SetPairEnabled {
    master: Address;
    enabled: Bool;
}
message(0x42504c42) SetConfig {
    launchFee: Int as coins;
    protocolFeeBps: Int as uint16;
    creatorFeeBps: Int as uint16;
    minTonLiquidity: Int as coins;
    tonPythFeedId: Int as uint256;
}
message(0x42504c34) SetFeeWallet {
    wallet: Address;
}
message(0x42504c43) Withdraw {
    amount: Int as coins;          // stray TON only; never touches pending launches
}

// ── Jetton minter (fixed supply, minted once) ─────────────────────────────
message(0x42504c32) MintLaunch {
    queryId: Int as uint64;
    pool: Address;
    poolAmount: Int as coins;
    creator: Address;
    creatorAmount: Int as coins;
}

// ── Pool ──────────────────────────────────────────────────────────────────
message(0x42504c50) PoolInit {
    queryId: Int as uint64;
    tokenMaster: Address;
    pairMaster: Address?;          // null = TON pair
    creator: Address;
    feeWallet: Address;
    protocolFeeBps: Int as uint16;
    creatorFeeBps: Int as uint16;
    pairAmount: Int as coins;      // TON pairs: the TON reserve (included in value)
}

/// Buy the token with TON. Attach amountIn + BUY_GAS.
/// `referrer` is the referral link used: the creator or one of the token's
/// registered referrers. Buys without a valid link are refunded.
message(0x42504c51) BuyTon {
    queryId: Int as uint64;
    amountIn: Int as coins;
    minOut: Int as coins;
    recipient: Address?;           // null = sender (bundler sets it per leg)
    referrer: Address;
}

/// forward_payload of a jetton transfer to the pool: sell the token, or buy
/// with the pair jetton. Invalid/failed swaps are refunded in full.
/// Buys need a valid `referrer`; on sells it is optional (no/invalid link →
/// the creator keeps the whole creator fee).
message(0x42504c52) SwapIntent {
    minOut: Int as coins;
    recipient: Address?;
    referrer: Address?;
}

// ── Referral links (per token, managed by its creator) ─────────────────────
/// Creator only. At most MAX_REFERRERS active links per token.
message(0x42504c55) AddReferrer {
    queryId: Int as uint64;
    referrer: Address;
}
/// Creator only. The link stops working for new trades; fees it already
/// earned stay claimable by the referrer.
message(0x42504c56) RemoveReferrer {
    queryId: Int as uint64;
    referrer: Address;
}
/// Referrer pulls their accrued share (jetton pools: attach 0.1 TON).
message(0x42504c57) ClaimReferral {
    queryId: Int as uint64;
}

struct ReferrerInfo {
    active: Bool;
    accrued: Int as coins;         // unclaimed, in the pair asset
    earned: Int as coins;          // lifetime, in the pair asset
    volume: Int as coins;          // pair-asset volume traded through this link
}

message(0x42504c53) ClaimFees {
    queryId: Int as uint64;
}

message(0x42504c54) Swapped {
    buy: Bool;
    trader: Address;
    amountIn: Int as coins;
    amountOut: Int as coins;
    reserveToken: Int as coins;
    reservePair: Int as coins;
}

struct PoolData {
    index: Int;
    factory: Address;
    tokenMaster: Address?;
    pairMaster: Address?;
    pairWallet: Address?;
    tokenWallet: Address?;
    creator: Address?;
    reserveToken: Int;
    reservePair: Int;
    protocolFeesAccrued: Int;
    creatorFeesAccrued: Int;
    referralFeesAccrued: Int;      // total unclaimed across all referrers
    activeReferrers: Int;
    protocolFeeBps: Int;
    creatorFeeBps: Int;
    tradingOpen: Bool;
}

// ── Bundler ───────────────────────────────────────────────────────────────
struct BundleLeg {
    recipient: Address;
    amount: Int as coins;          // TON spent on this leg
    minOut: Int as coins;
}

/// Buy from one pool into many wallets in one transaction.
/// Attach Σ amount + legs × LEG_GAS + bundler fee.
message(0x42504c60) BundleBuy {
    queryId: Int as uint64;
    pool: Address;
    referrer: Address;             // referral link used for every leg
    count: Int as uint8;
    legs: map<Int as uint8, BundleLeg>;
}

// ═══ TEP-74 jetton standard ═════════════════════════════════════════════
message(0x0f8a7ea5) TokenTransfer {
    queryId: Int as uint64;
    amount: Int as coins;
    destination: Address;
    responseDestination: Address?;
    customPayload: Cell?;
    forwardTonAmount: Int as coins;
    forwardPayload: Slice as remaining;
}

message(0x178d4519) TokenTransferInternal {
    queryId: Int as uint64;
    amount: Int as coins;
    from: Address;
    responseDestination: Address?;
    forwardTonAmount: Int as coins;
    forwardPayload: Slice as remaining;
}

message(0x7362d09c) TokenNotification {
    queryId: Int as uint64;
    amount: Int as coins;
    from: Address;
    forwardPayload: Slice as remaining;
}

message(0x595f07bc) TokenBurn {
    queryId: Int as uint64;
    amount: Int as coins;
    responseDestination: Address?;
    customPayload: Cell?;
}

message(0x7bdd97de) TokenBurnNotification {
    queryId: Int as uint64;
    amount: Int as coins;
    sender: Address;
    responseDestination: Address?;
}

message(0xd53276db) TokenExcesses {
    queryId: Int as uint64;
}

// TEP-89 wallet discovery
message(0x2c76b973) ProvideWalletAddress {
    queryId: Int as uint64;
    ownerAddress: Address;
    includeAddress: Bool;
}

message(0xd1735400) TakeWalletAddress {
    queryId: Int as uint64;
    walletAddress: Address;
    ownerAddress: Cell?;
}

struct JettonData {
    totalSupply: Int;
    mintable: Bool;
    owner: Address;
    content: Cell;
    walletCode: Cell;
}

struct JettonWalletData {
    balance: Int;
    owner: Address;
    master: Address;
    code: Cell;
}

// ── Shared helpers ────────────────────────────────────────────────────────

/// TEP-74 forward_payload is `Either Cell ^Cell`: unwrap to a plain slice.
inline fun unwrapForwardPayload(p: Slice): Slice {
    if (p.bits() == 0) {
        return p;
    }
    if (p.loadBit()) {
        return p.loadRef().beginParse();
    }
    return p;
}

/// Jetton transfer body for returning/sending jettons from a contract's wallet.
inline fun jettonTransfer(queryId: Int, amount: Int, to: Address, response: Address?, fwdTon: Int): Cell {
    return TokenTransfer{
        queryId: queryId,
        amount: amount,
        destination: to,
        responseDestination: response,
        customPayload: null,
        forwardTonAmount: fwdTon,
        forwardPayload: beginCell().storeBit(false).endCell().beginParse()
    }.toCell();
}

// ── StakeVault (holders stake the jetton, earn TON from pool fees) ─────────

/// TON rewards for stakers. Sent by the pool on ClaimFees, or by anyone
/// topping the vault up. Everything attached above VAULT_GAS is distributed.
message(0x42504c70) StakeRewards {
    queryId: Int as uint64;
}

/// Withdraw `amount` staked jettons (and the pending TON). Attach ~0.1 TON.
message(0x42504c71) Unstake {
    queryId: Int as uint64;
    amount: Int as coins;
}

/// Collect pending TON rewards without unstaking.
message(0x42504c72) ClaimRewards {
    queryId: Int as uint64;
}

struct StakerInfo {
    amount: Int as coins;      // jettons staked
    debt: Int;                 // amount × accPerShare at the last update
    pending: Int as coins;     // TON earned, not yet paid
}

struct VaultData {
    pool: Address;
    tokenMaster: Address;
    tokenWallet: Address;
    totalStaked: Int;
    stakers: Int;
    accPerShare: Int;
    rewardsTotal: Int;         // TON ever distributed to stakers
    carry: Int;                // TON received while nobody was staked
}
