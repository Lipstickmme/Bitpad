import "@stdlib/ownable";
import "./messages";
import "./jetton";
import "./pool";

// ═══════════════════════════════════════════════════════════════════════════
//  BitpadFactory — launches paired tokens.
//
//  One transaction from the creator deploys:
//    1. BitpadJetton  (fixed supply, minted once, never mintable again)
//    2. BitpadPool    (TOKEN ⟷ PAIR, liquidity locked, trading opens immediately)
//  and forwards the launch fee to the fee wallet.
//
//  PAIR is native TON (message `Launch`) or a jetton from the on-chain registry
//  (jetton transfer to the factory carrying `LaunchWithJetton`).
//  Every launch is recorded: launch_count, minter(i), pool(i).
// ═══════════════════════════════════════════════════════════════════════════

const MINTER_VALUE: Int = ton("0.2");     // minter deploy + two wallet deploys
const POOL_VALUE: Int = ton("0.15");      // pool deploy + rent + TEP-89 query
const PAIR_SEND_GAS: Int = ton("0.15");   // later transfer of pair jettons to the pool
const LAUNCH_GAS: Int = ton("0.45");      // MINTER_VALUE + POOL_VALUE + fees/overhead
const MAX_CREATOR_BPS: Int = 2000;        // creator may keep at most 20% of supply
const FACTORY_STORAGE: Int = ton("0.1");

struct PendingLaunch {
    creator: Address;
    pairMaster: Address;
    amount: Int as coins;
}

struct FactoryConfig {
    owner: Address;
    feeWallet: Address;
    launchFee: Int;
    protocolFeeBps: Int;
    creatorFeeBps: Int;
    minTonLiquidity: Int;
    tonPythFeedId: Int;
    launches: Int;
}

contract BitpadFactory with Ownable {
    owner: Address;
    feeWallet: Address;
    launchFee: Int as coins;
    protocolFeeBps: Int as uint16;
    creatorFeeBps: Int as uint16;
    minTonLiquidity: Int as coins;
    tonPythFeedId: Int as uint256 = 0;

    launches: Int as uint64 = 0;
    minters: map<Int as uint64, Address>;
    pools: map<Int as uint64, Address>;

    pairs: map<Address, PairInfo>;            // jetton master → registry entry
    walletToMaster: map<Address, Address>;    // factory's jetton wallet → master
    pending: map<Int as uint64, PendingLaunch>;
    reservedGas: Int as coins = 0;            // TON owed to pending jetton launches

    init(owner: Address, feeWallet: Address, launchFee: Int, protocolFeeBps: Int, creatorFeeBps: Int, minTonLiquidity: Int) {
        self.owner = owner;
        self.feeWallet = feeWallet;
        self.launchFee = launchFee;
        self.protocolFeeBps = protocolFeeBps;
        self.creatorFeeBps = creatorFeeBps;
        self.minTonLiquidity = minTonLiquidity;
    }

    receive() {}

    // ── Launch paired with TON ─────────────────────────────────────────────

    receive(msg: Launch) {
        let ctx: Context = context();
        require(msg.supply > 0 && msg.creatorBps <= MAX_CREATOR_BPS, "Bad supply or creator share");
        require(msg.pairAmount >= self.minTonLiquidity, "Liquidity below minimum");
        require(ctx.value >= self.launchFee + msg.pairAmount + LAUNCH_GAS, "Insufficient value");

        self.deploy(ctx.sender, msg.queryId, msg.supply, msg.creatorBps, msg.content, null, msg.pairAmount);
        self.payLaunchFee();
        self.refundExcess(ctx.sender, ctx.value - self.launchFee - msg.pairAmount - LAUNCH_GAS);
    }

    // ── Launch paired with a registered jetton ─────────────────────────────

    receive(msg: TokenNotification) {
        let ctx: Context = context();
        let master: Address? = self.walletToMaster.get(ctx.sender);
        if (master == null) {
            // not one of our registered wallets — hand the jettons back
            send(SendParameters{ to: ctx.sender, value: 0, mode: SendRemainingValue, bounce: false, body: jettonTransfer(msg.queryId, msg.amount, msg.from, msg.from, 0) });
            return;
        }
        let info: PairInfo = self.pairs.get(master!!)!!;
        let launch: LaunchWithJetton? = null;
        try {
            launch = LaunchWithJetton.fromSlice(unwrapForwardPayload(msg.forwardPayload));
        } catch (e) {
            launch = null;
        }
        let ok: Bool = launch != null && info.enabled && msg.amount >= info.minLiquidity
            && ctx.value >= self.launchFee + LAUNCH_GAS + PAIR_SEND_GAS;
        if (ok) {
            ok = launch!!.supply > 0 && launch!!.creatorBps <= MAX_CREATOR_BPS;
        }
        if (!ok) {
            send(SendParameters{ to: ctx.sender, value: 0, mode: SendRemainingValue, bounce: false, body: jettonTransfer(msg.queryId, msg.amount, msg.from, msg.from, 0) });
            return;
        }
        let l: LaunchWithJetton = launch!!;
        let index: Int = self.deploy(msg.from, msg.queryId, l.supply, l.creatorBps, l.content, master, msg.amount);
        self.pending.set(index, PendingLaunch{ creator: msg.from, pairMaster: master!!, amount: msg.amount });
        self.reservedGas += PAIR_SEND_GAS;
        self.payLaunchFee();
        self.refundExcess(msg.from, ctx.value - self.launchFee - LAUNCH_GAS - PAIR_SEND_GAS);
    }

    /// The pool discovered its pair-jetton wallet: send it the initial liquidity.
    receive(msg: PoolReady) {
        let minter: Address? = self.minters.get(msg.index);
        require(minter != null, "Unknown launch");
        require(sender() == contractAddress(initOf BitpadPool(myAddress(), msg.index, minter!!)), "Only the pool");
        let p: PendingLaunch? = self.pending.get(msg.index);
        require(p != null, "Nothing pending");
        let info: PairInfo = self.pairs.get(p!!.pairMaster)!!;
        self.pending.set(msg.index, null);
        self.reservedGas -= PAIR_SEND_GAS;
        send(SendParameters{
            to: info.wallet!!,
            value: PAIR_SEND_GAS,
            mode: SendPayGasSeparately,
            bounce: true,
            body: jettonTransfer(msg.index, p!!.amount, sender(), p!!.creator, ton("0.05"))
        });
    }

    fun deploy(creator: Address, queryId: Int, supply: Int, creatorBps: Int, content: Cell, pairMaster: Address?, pairAmount: Int): Int {
        let index: Int = self.launches;
        let minterInit: StateInit = initOf BitpadJetton(myAddress(), index, content, creator, pairMaster);
        let minter: Address = contractAddress(minterInit);
        let poolInit: StateInit = initOf BitpadPool(myAddress(), index, minter);
        let pool: Address = contractAddress(poolInit);
        let creatorAmount: Int = supply * creatorBps / 10000;

        // Pool first (one hop) — the minted pool share reaches it three hops later.
        send(SendParameters{
            to: pool,
            value: POOL_VALUE + (pairMaster == null ? pairAmount : 0),
            mode: SendPayGasSeparately,
            bounce: false,
            code: poolInit.code,
            data: poolInit.data,
            body: PoolInit{
                queryId: queryId,
                tokenMaster: minter,
                pairMaster: pairMaster,
                creator: creator,
                feeWallet: self.feeWallet,
                protocolFeeBps: self.protocolFeeBps,
                creatorFeeBps: self.creatorFeeBps,
                pairAmount: pairAmount
            }.toCell()
        });
        send(SendParameters{
            to: minter,
            value: MINTER_VALUE,
            mode: SendPayGasSeparately,
            bounce: false,
            code: minterInit.code,
            data: minterInit.data,
            body: MintLaunch{ queryId: queryId, pool: pool, poolAmount: supply - creatorAmount, creator: creator, creatorAmount: creatorAmount }.toCell()
        });

        self.minters.set(index, minter);
        self.pools.set(index, pool);
        self.launches = index + 1;
        emit(Launched{ index: index, minter: minter, pool: pool, creator: creator, supply: supply, pair: pairMaster, pairAmount: pairAmount }.toCell());
        return index;
    }

    fun payLaunchFee() {
        if (self.launchFee > 0) {
            send(SendParameters{ to: self.feeWallet, value: self.launchFee, mode: SendPayGasSeparately | SendIgnoreErrors, bounce: false, body: "Bitpad launch fee".asComment() });
        }
    }

    fun refundExcess(to: Address, amount: Int) {
        if (amount > ton("0.01")) {
            send(SendParameters{ to: to, value: amount, mode: SendIgnoreErrors, bounce: false, body: "Bitpad: excess returned".asComment() });
        }
    }

    // ── Pair registry (owner) ──────────────────────────────────────────────

    /// Register a pairable jetton. Attach ≥0.1 TON: the factory asks the
    /// master for its own wallet address (TEP-89) before the pair can be used.
    receive(msg: AddPair) {
        self.requireOwner();
        self.pairs.set(msg.master, PairInfo{
            symbol: msg.info.symbol,
            decimals: msg.info.decimals,
            kind: msg.info.kind,
            pythFeedId: msg.info.pythFeedId,
            minLiquidity: msg.info.minLiquidity,
            wallet: null,
            enabled: msg.info.enabled
        });
        send(SendParameters{ to: msg.master, value: ton("0.05"), mode: SendPayGasSeparately, body: ProvideWalletAddress{ queryId: 0, ownerAddress: myAddress(), includeAddress: false }.toCell() });
    }

    receive(msg: TakeWalletAddress) {
        let info: PairInfo? = self.pairs.get(sender());
        require(info != null, "Unknown master");
        require(info!!.wallet == null, "Wallet already known");
        self.walletToMaster.set(msg.walletAddress, sender());
        self.pairs.set(sender(), PairInfo{
            symbol: info!!.symbol, decimals: info!!.decimals, kind: info!!.kind, pythFeedId: info!!.pythFeedId,
            minLiquidity: info!!.minLiquidity, wallet: msg.walletAddress, enabled: info!!.enabled
        });
    }

    receive(msg: SetPairEnabled) {
        self.requireOwner();
        let info: PairInfo? = self.pairs.get(msg.master);
        require(info != null, "Unknown pair");
        self.pairs.set(msg.master, PairInfo{
            symbol: info!!.symbol, decimals: info!!.decimals, kind: info!!.kind, pythFeedId: info!!.pythFeedId,
            minLiquidity: info!!.minLiquidity, wallet: info!!.wallet, enabled: msg.enabled
        });
    }

    receive(msg: SetConfig) {
        self.requireOwner();
        require(msg.protocolFeeBps + msg.creatorFeeBps <= 1000, "Trading fee capped at 10%");
        self.launchFee = msg.launchFee;
        self.protocolFeeBps = msg.protocolFeeBps;
        self.creatorFeeBps = msg.creatorFeeBps;
        self.minTonLiquidity = msg.minTonLiquidity;
        self.tonPythFeedId = msg.tonPythFeedId;
    }

    receive(msg: SetFeeWallet) {
        self.requireOwner();
        self.feeWallet = msg.wallet;
    }

    /// Withdraw stray TON. Can never touch gas reserved for pending launches.
    receive(msg: Withdraw) {
        self.requireOwner();
        require(msg.amount <= myBalance() - self.reservedGas - FACTORY_STORAGE, "Exceeds free balance");
        send(SendParameters{ to: self.owner, value: msg.amount, mode: SendPayGasSeparately, bounce: false });
    }

    // ── Getters ────────────────────────────────────────────────────────────

    get fun launch_count(): Int { return self.launches; }
    get fun minter(index: Int): Address? { return self.minters.get(index); }
    get fun pool(index: Int): Address? { return self.pools.get(index); }
    get fun pair(master: Address): PairInfo? { return self.pairs.get(master); }
    get fun pending_launch(index: Int): PendingLaunch? { return self.pending.get(index); }
    get fun launch_fee(): Int { return self.launchFee; }

    get fun config(): FactoryConfig {
        return FactoryConfig{
            owner: self.owner, feeWallet: self.feeWallet, launchFee: self.launchFee,
            protocolFeeBps: self.protocolFeeBps, creatorFeeBps: self.creatorFeeBps,
            minTonLiquidity: self.minTonLiquidity, tonPythFeedId: self.tonPythFeedId, launches: self.launches
        };
    }

    /// Deterministic addresses for launch #index (usable before it happens).
    get fun minter_address(index: Int, content: Cell, creator: Address, pair: Address?): Address {
        return contractAddress(initOf BitpadJetton(myAddress(), index, content, creator, pair));
    }
    get fun pool_address(index: Int, minter: Address): Address {
        return contractAddress(initOf BitpadPool(myAddress(), index, minter));
    }
}
