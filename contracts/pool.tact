import "./messages";
import "./jetton";

// ═══════════════════════════════════════════════════════════════════════════
//  BitpadPool — one constant-product pool per launch: TOKEN ⟷ PAIR
//
//  • PAIR is native TON or a registered jetton (USDT, GRAM, XAUt, a bridged
//    stock…). The pool prices TOKEN in PAIR units: price = reservePair / reserveToken.
//  • Liquidity is seeded once by the factory and is LOCKED: there are no LP
//    tokens and no withdraw path. Nobody can pull the pool.
//  • Fees are charged in the PAIR asset on every trade (buy: on input, sell:
//    on output): a protocol fee (→ fee wallet) and a creator fee.
//  • Referral links: the creator registers up to MAX_REFERRERS wallets. Every
//    buy must come through a link (the creator's own address or a registered
//    referrer). The creator fee on a trade is split 50/50 between the creator
//    and the referrer whose link was used. Sells may name a link; without a
//    valid one the creator keeps the whole creator fee.
//  • Fees accrue in the pool; ClaimFees pays protocol + creator, and each
//    referrer pulls their own share with ClaimReferral.
//  • Any swap that can't be honoured (slippage, bad payload, pool not open)
//    is refunded in full.
// ═══════════════════════════════════════════════════════════════════════════

const POOL_STORAGE: Int = ton("0.05");  // TON the pool always keeps for rent
const BUY_GAS: Int = ton("0.1");        // attach to BuyTon on top of amountIn
const JETTON_OUT_GAS: Int = ton("0.1"); // min forward TON for jetton-in swaps
const BPS: Int = 10000;
const MAX_REFERRERS: Int = 20;          // referral links per token
const REFERRER_SHARE_BPS: Int = 5000;   // referrer's share of the creator fee

struct Quote {
    out: Int;
    net: Int;          // input that enters the reserve (buys) / gross output leaving it (sells)
    protocolFee: Int;
    creatorFee: Int;
}

contract BitpadPool {
    factory: Address;
    index: Int as uint64;
    tokenMaster: Address;
    tokenWallet: Address;          // derived: the pool's own wallet for TOKEN

    initialized: Bool = false;
    pairMaster: Address?;          // null = TON
    pairWallet: Address?;          // the pool's wallet for PAIR (TEP-89 discovered)
    creator: Address?;
    feeWallet: Address?;
    protocolFeeBps: Int as uint16 = 0;
    creatorFeeBps: Int as uint16 = 0;

    reserveToken: Int as coins = 0;
    reservePair: Int as coins = 0;
    pairSeeded: Bool = false;
    protocolAcc: Int as coins = 0;
    creatorAcc: Int as coins = 0;

    referrers: map<Address, ReferrerInfo>;
    activeReferrers: Int as uint8 = 0;
    referralAcc: Int as coins = 0;         // Σ unclaimed referrer shares

    init(factory: Address, index: Int, tokenMaster: Address) {
        self.factory = factory;
        self.index = index;
        self.tokenMaster = tokenMaster;
        self.tokenWallet = contractAddress(initOf BitpadJettonWallet(myAddress(), tokenMaster));
    }

    // Plain TON top-ups (e.g. for storage rent)
    receive() {}

    // ── Setup ──────────────────────────────────────────────────────────────

    receive(msg: PoolInit) {
        require(sender() == self.factory, "Only factory");
        require(!self.initialized, "Already initialized");
        require(msg.tokenMaster == self.tokenMaster, "Token mismatch");
        require(msg.protocolFeeBps + msg.creatorFeeBps <= 1000, "Fee too high");
        self.initialized = true;
        self.pairMaster = msg.pairMaster;
        self.creator = msg.creator;
        self.feeWallet = msg.feeWallet;
        self.protocolFeeBps = msg.protocolFeeBps;
        self.creatorFeeBps = msg.creatorFeeBps;
        if (msg.pairMaster == null) {
            self.reservePair = msg.pairAmount;
            self.pairSeeded = true;
        } else {
            // Discover our wallet for the pair jetton (TEP-89); the factory sends
            // the pair liquidity once we report ready.
            send(SendParameters{
                to: msg.pairMaster!!,
                value: ton("0.05"),
                mode: SendPayGasSeparately,
                body: ProvideWalletAddress{ queryId: msg.queryId, ownerAddress: myAddress(), includeAddress: false }.toCell()
            });
        }
    }

    receive(msg: TakeWalletAddress) {
        require(self.pairMaster != null && sender() == self.pairMaster!!, "Unexpected sender");
        require(self.pairWallet == null, "Wallet already known");
        self.pairWallet = msg.walletAddress;
        send(SendParameters{ to: self.factory, value: 0, mode: SendRemainingValue, bounce: false, body: PoolReady{ index: self.index }.toCell() });
    }

    // ── Buy with TON ───────────────────────────────────────────────────────

    receive(msg: BuyTon) {
        let ctx: Context = context();
        let to: Address = msg.recipient != null ? msg.recipient!! : ctx.sender;
        require(self.pairMaster == null, "Not a TON pool");
        require(msg.amountIn > 0 && ctx.value >= msg.amountIn + BUY_GAS, "Insufficient value");
        let q: Quote = self.quoteBuy(msg.amountIn);
        if (!self.tradingOpen() || !self.isValidReferrer(msg.referrer) || q.out == 0 || q.out < msg.minOut) {
            // full refund (minus this transaction's compute fee)
            send(SendParameters{ to: to, value: 0, mode: SendRemainingValue, bounce: false, body: "Bitpad: swap refunded".asComment() });
            return;
        }
        self.applyBuy(q, msg.referrer, msg.amountIn);
        emit(Swapped{ buy: true, trader: to, amountIn: msg.amountIn, amountOut: q.out, reserveToken: self.reserveToken, reservePair: self.reservePair }.toCell());
        nativeReserve(self.tonTracked(), ReserveAtMost);
        send(SendParameters{
            to: self.tokenWallet,
            value: 0,
            mode: SendRemainingBalance,
            bounce: true,
            body: jettonTransfer(msg.queryId, q.out, to, to, 0)
        });
    }

    // ── Jettons in: initial seeds, sells, and buys with the pair jetton ────

    receive(msg: TokenNotification) {
        let ctx: Context = context();

        if (ctx.sender == self.tokenWallet) {
            // Initial TOKEN reserve minted by the minter at launch
            if (msg.from == self.tokenMaster && self.reserveToken == 0) {
                self.reserveToken = msg.amount;
                return;
            }
            self.onSell(msg);
            return;
        }

        if (self.pairWallet != null && ctx.sender == self.pairWallet!!) {
            // Initial PAIR reserve sent by the factory at launch
            if (msg.from == self.factory && !self.pairSeeded) {
                self.reservePair = msg.amount;
                self.pairSeeded = true;
                return;
            }
            self.onPairBuy(msg);
            return;
        }

        // Unknown jetton: try to hand it back through the wallet that notified us.
        send(SendParameters{ to: ctx.sender, value: 0, mode: SendRemainingValue, bounce: false, body: jettonTransfer(msg.queryId, msg.amount, msg.from, msg.from, 0) });
    }

    fun onSell(msg: TokenNotification) {
        let ctx: Context = context();
        let intent: SwapIntent? = self.parseIntent(msg.forwardPayload);
        let q: Quote = self.quoteSell(msg.amount);
        if (intent == null || !self.tradingOpen() || ctx.value < JETTON_OUT_GAS || q.out == 0 || q.out < intent!!.minOut) {
            self.refundJetton(self.tokenWallet, msg);
            return;
        }
        let to: Address = intent!!.recipient != null ? intent!!.recipient!! : msg.from;
        self.reserveToken += msg.amount;
        self.reservePair -= q.net;
        self.protocolAcc += q.protocolFee;
        self.creditCreatorFee(q.creatorFee, intent!!.referrer, q.net);
        emit(Swapped{ buy: false, trader: to, amountIn: msg.amount, amountOut: q.out, reserveToken: self.reserveToken, reservePair: self.reservePair }.toCell());
        nativeReserve(self.tonTracked(), ReserveAtMost);
        if (self.pairMaster == null) {
            // TON out: everything above the tracked balance = q.out + leftover gas
            send(SendParameters{ to: to, value: 0, mode: SendRemainingBalance, bounce: false, body: "Bitpad: sold".asComment() });
        } else {
            send(SendParameters{ to: self.pairWallet!!, value: 0, mode: SendRemainingBalance, bounce: true, body: jettonTransfer(msg.queryId, q.out, to, to, 0) });
        }
    }

    fun onPairBuy(msg: TokenNotification) {
        let ctx: Context = context();
        let intent: SwapIntent? = self.parseIntent(msg.forwardPayload);
        let q: Quote = self.quoteBuy(msg.amount);
        let ok: Bool = intent != null && self.tradingOpen() && ctx.value >= JETTON_OUT_GAS && q.out > 0;
        if (ok) {
            ok = q.out >= intent!!.minOut && intent!!.referrer != null && self.isValidReferrer(intent!!.referrer!!);
        }
        if (!ok) {
            self.refundJetton(self.pairWallet!!, msg);
            return;
        }
        let to: Address = intent!!.recipient != null ? intent!!.recipient!! : msg.from;
        self.applyBuy(q, intent!!.referrer!!, msg.amount);
        emit(Swapped{ buy: true, trader: to, amountIn: msg.amount, amountOut: q.out, reserveToken: self.reserveToken, reservePair: self.reservePair }.toCell());
        nativeReserve(self.tonTracked(), ReserveAtMost);
        send(SendParameters{ to: self.tokenWallet, value: 0, mode: SendRemainingBalance, bounce: true, body: jettonTransfer(msg.queryId, q.out, to, to, 0) });
    }

    // ── Fees ───────────────────────────────────────────────────────────────

    /// Anyone may trigger; funds only ever go to the fee wallet and the creator.
    receive(msg: ClaimFees) {
        require(self.initialized, "Not initialized");
        let p: Int = self.protocolAcc;
        let c: Int = self.creatorAcc;
        require(p + c > 0, "Nothing to claim");
        self.protocolAcc = 0;
        self.creatorAcc = 0;
        if (self.pairMaster == null) {
            if (p > 0) { send(SendParameters{ to: self.feeWallet!!, value: p, mode: SendPayGasSeparately, bounce: false, body: "Bitpad protocol fees".asComment() }); }
            if (c > 0) { send(SendParameters{ to: self.creator!!, value: c, mode: SendPayGasSeparately, bounce: false, body: "Bitpad creator fees".asComment() }); }
        } else {
            require(context().value >= ton("0.2"), "Attach 0.2 TON for jetton transfers");
            if (p > 0) { send(SendParameters{ to: self.pairWallet!!, value: ton("0.08"), mode: SendPayGasSeparately, bounce: true, body: jettonTransfer(msg.queryId, p, self.feeWallet!!, self.feeWallet!!, 0) }); }
            if (c > 0) { send(SendParameters{ to: self.pairWallet!!, value: ton("0.08"), mode: SendPayGasSeparately, bounce: true, body: jettonTransfer(msg.queryId, c, self.creator!!, self.creator!!, 0) }); }
        }
    }

    // ── Referral links ─────────────────────────────────────────────────────

    receive(msg: AddReferrer) {
        require(self.initialized && sender() == self.creator!!, "Only the creator");
        require(msg.referrer != self.creator!!, "Creator already has a link");
        let r: ReferrerInfo? = self.referrers.get(msg.referrer);
        require(r == null || !r!!.active, "Already a referrer");
        require(self.activeReferrers < MAX_REFERRERS, "All referral links are taken");
        self.activeReferrers += 1;
        self.referrers.set(msg.referrer, r == null
            ? ReferrerInfo{ active: true, accrued: 0, earned: 0, volume: 0 }
            : ReferrerInfo{ active: true, accrued: r!!.accrued, earned: r!!.earned, volume: r!!.volume });
        self.replyExcess();
    }

    receive(msg: RemoveReferrer) {
        require(self.initialized && sender() == self.creator!!, "Only the creator");
        let r: ReferrerInfo? = self.referrers.get(msg.referrer);
        require(r != null && r!!.active, "Not an active referrer");
        self.activeReferrers -= 1;
        // earned fees stay claimable
        self.referrers.set(msg.referrer, ReferrerInfo{ active: false, accrued: r!!.accrued, earned: r!!.earned, volume: r!!.volume });
        self.replyExcess();
    }

    receive(msg: ClaimReferral) {
        let r: ReferrerInfo? = self.referrers.get(sender());
        require(r != null && r!!.accrued > 0, "Nothing to claim");
        let amount: Int = r!!.accrued;
        self.referralAcc -= amount;
        self.referrers.set(sender(), ReferrerInfo{ active: r!!.active, accrued: 0, earned: r!!.earned, volume: r!!.volume });
        if (self.pairMaster == null) {
            // payout + whatever gas the caller attached that wasn't used
            send(SendParameters{ to: sender(), value: amount, mode: SendRemainingValue, bounce: false, body: "Bitpad referral fees".asComment() });
        } else {
            require(context().value >= ton("0.1"), "Attach 0.1 TON for the jetton transfer");
            send(SendParameters{ to: self.pairWallet!!, value: 0, mode: SendRemainingValue, bounce: true, body: jettonTransfer(msg.queryId, amount, sender(), sender(), 0) });
        }
    }

    /// Return unused gas to the caller without touching tracked balances.
    fun replyExcess() {
        send(SendParameters{ to: sender(), value: 0, mode: SendRemainingValue | SendIgnoreErrors, bounce: false });
    }

    /// If one of our own jetton transfers bounces, the jettons never left:
    /// restore the reserve so accounting stays exact.
    bounced(msg: bounced<TokenTransfer>) {
        if (sender() == self.tokenWallet) {
            self.reserveToken += msg.amount;
        } else if (self.pairWallet != null && sender() == self.pairWallet!!) {
            self.reservePair += msg.amount;
        }
    }

    // ── Internals ──────────────────────────────────────────────────────────

    fun tradingOpen(): Bool {
        return self.initialized && self.pairSeeded && self.reserveToken > 0 && self.reservePair > 0;
    }

    /// TON the pool must keep: rent + (for TON pools) reserve and unclaimed fees.
    fun tonTracked(): Int {
        if (self.pairMaster == null) {
            return self.reservePair + self.protocolAcc + self.creatorAcc + self.referralAcc + POOL_STORAGE;
        }
        return POOL_STORAGE;
    }

    fun applyBuy(q: Quote, referrer: Address, amountIn: Int) {
        self.reservePair += q.net;
        self.reserveToken -= q.out;
        self.protocolAcc += q.protocolFee;
        self.creditCreatorFee(q.creatorFee, referrer, amountIn);
    }

    fun isValidReferrer(a: Address): Bool {
        if (a == self.creator!!) {
            return true;
        }
        let r: ReferrerInfo? = self.referrers.get(a);
        return r != null && r!!.active;
    }

    /// Split the creator fee 50/50 with the referrer whose link was used.
    /// Creator's own link, no link, or an inactive link → creator keeps it all.
    fun creditCreatorFee(fee: Int, referrer: Address?, volume: Int) {
        if (referrer == null || referrer!! == self.creator!!) {
            self.creatorAcc += fee;
            return;
        }
        let r: ReferrerInfo? = self.referrers.get(referrer!!);
        if (r == null || !r!!.active) {
            self.creatorAcc += fee;
            return;
        }
        let share: Int = fee * REFERRER_SHARE_BPS / BPS;
        self.creatorAcc += fee - share;
        self.referralAcc += share;
        self.referrers.set(referrer!!, ReferrerInfo{
            active: true,
            accrued: r!!.accrued + share,
            earned: r!!.earned + share,
            volume: r!!.volume + volume
        });
    }

    fun quoteBuy(amountIn: Int): Quote {
        let pf: Int = amountIn * self.protocolFeeBps / BPS;
        let cf: Int = amountIn * self.creatorFeeBps / BPS;
        let net: Int = amountIn - pf - cf;
        if (self.reserveToken == 0 || self.reservePair + net == 0) {
            return Quote{ out: 0, net: net, protocolFee: pf, creatorFee: cf };
        }
        return Quote{ out: net * self.reserveToken / (self.reservePair + net), net: net, protocolFee: pf, creatorFee: cf };
    }

    fun quoteSell(amountIn: Int): Quote {
        if (self.reservePair == 0 || self.reserveToken + amountIn == 0) {
            return Quote{ out: 0, net: 0, protocolFee: 0, creatorFee: 0 };
        }
        let gross: Int = amountIn * self.reservePair / (self.reserveToken + amountIn);
        let pf: Int = gross * self.protocolFeeBps / BPS;
        let cf: Int = gross * self.creatorFeeBps / BPS;
        return Quote{ out: gross - pf - cf, net: gross, protocolFee: pf, creatorFee: cf };
    }

    fun parseIntent(payload: Slice): SwapIntent? {
        let intent: SwapIntent? = null;
        try {
            let s: Slice = unwrapForwardPayload(payload);
            intent = SwapIntent.fromSlice(s);
        } catch (e) {
            intent = null;
        }
        return intent;
    }

    fun refundJetton(wallet: Address, msg: TokenNotification) {
        send(SendParameters{ to: wallet, value: 0, mode: SendRemainingValue, bounce: false, body: jettonTransfer(msg.queryId, msg.amount, msg.from, msg.from, 0) });
    }

    // ── Getters ────────────────────────────────────────────────────────────

    get fun pool_data(): PoolData {
        return PoolData{
            index: self.index,
            factory: self.factory,
            tokenMaster: self.tokenMaster,
            pairMaster: self.pairMaster,
            pairWallet: self.pairWallet,
            tokenWallet: self.tokenWallet,
            creator: self.creator,
            reserveToken: self.reserveToken,
            reservePair: self.reservePair,
            protocolFeesAccrued: self.protocolAcc,
            creatorFeesAccrued: self.creatorAcc,
            referralFeesAccrued: self.referralAcc,
            activeReferrers: self.activeReferrers,
            protocolFeeBps: self.protocolFeeBps,
            creatorFeeBps: self.creatorFeeBps,
            tradingOpen: self.tradingOpen()
        };
    }

    /// Spot price: raw PAIR units per 1 whole TOKEN (10^9 raw units).
    /// USD price = price / 10^pairDecimals × USD price of the pair asset.
    get fun price(): Int {
        if (self.reserveToken == 0) { return 0; }
        return self.reservePair * 1000000000 / self.reserveToken;
    }

    get fun referrer(a: Address): ReferrerInfo? {
        return self.referrers.get(a);
    }

    /// Can `a` be used as a referral link for buys right now?
    get fun is_referrer(a: Address): Bool {
        return self.initialized && self.isValidReferrer(a);
    }

    /// All referral links (active and removed) with their stats.
    get fun referrers(): map<Address, ReferrerInfo> {
        return self.referrers;
    }

    get fun quote_buy(amountIn: Int): Int {
        return self.quoteBuy(amountIn).out;
    }

    get fun quote_sell(amountIn: Int): Int {
        return self.quoteSell(amountIn).out;
    }
}
