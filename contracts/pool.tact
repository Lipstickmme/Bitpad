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
//    on output) and accrue in the pool until anyone calls ClaimFees, which
//    pays the protocol share to the fee wallet and the creator share to the creator.
//  • Any swap that can't be honoured (slippage, bad payload, pool not open)
//    is refunded in full.
// ═══════════════════════════════════════════════════════════════════════════

const POOL_STORAGE: Int = ton("0.05");  // TON the pool always keeps for rent
const BUY_GAS: Int = ton("0.1");        // attach to BuyTon on top of amountIn
const JETTON_OUT_GAS: Int = ton("0.1"); // min forward TON for jetton-in swaps
const BPS: Int = 10000;

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
        if (!self.tradingOpen() || q.out == 0 || q.out < msg.minOut) {
            // full refund (minus this transaction's compute fee)
            send(SendParameters{ to: to, value: 0, mode: SendRemainingValue, bounce: false, body: "Bitpad: swap refunded".asComment() });
            return;
        }
        self.applyBuy(q);
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
        self.creatorAcc += q.creatorFee;
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
        if (intent == null || !self.tradingOpen() || ctx.value < JETTON_OUT_GAS || q.out == 0 || q.out < intent!!.minOut) {
            self.refundJetton(self.pairWallet!!, msg);
            return;
        }
        let to: Address = intent!!.recipient != null ? intent!!.recipient!! : msg.from;
        self.applyBuy(q);
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
            return self.reservePair + self.protocolAcc + self.creatorAcc + POOL_STORAGE;
        }
        return POOL_STORAGE;
    }

    fun applyBuy(q: Quote) {
        self.reservePair += q.net;
        self.reserveToken -= q.out;
        self.protocolAcc += q.protocolFee;
        self.creatorAcc += q.creatorFee;
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

    get fun quote_buy(amountIn: Int): Int {
        return self.quoteBuy(amountIn).out;
    }

    get fun quote_sell(amountIn: Int): Int {
        return self.quoteSell(amountIn).out;
    }
}
