// ── Bitpad messages ──────────────────────────────────────────────────────
// Opcode must match OP_LAUNCH in src/lib/ton/launch.ts
message(0x42504c31) Launch {
    queryId: Int as uint64;
    supply: Int as coins;       // raw units (supply * 10^decimals)
    content: Cell;              // TEP-64 off-chain content (0x01 + URI)
    pair: Address?;             // jetton master of the paired asset (null = TON / off-chain asset)
}

message(0x42504c32) MintAll {
    queryId: Int as uint64;
    amount: Int as coins;
    receiver: Address;
}

message(0x42504c33) SetLaunchFee {
    fee: Int as coins;
}

message(0x42504c34) SetFeeWallet {
    wallet: Address;
}

message(0x42504c35) Launched {
    index: Int as uint64;
    minter: Address;
    creator: Address;
    supply: Int as coins;
    pair: Address?;
}

// ── TEP-74 jetton messages ───────────────────────────────────────────────
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
