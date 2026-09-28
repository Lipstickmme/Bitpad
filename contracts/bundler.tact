import "@stdlib/ownable";
import "./messages";
import "./pool";

// ═══════════════════════════════════════════════════════════════════════════
//  BitpadBundler — buy from one Bitpad pool into up to 100 wallets in a
//  single transaction (one signature, one block). Each leg is a normal
//  BuyTon with `recipient` set, so tokens land directly in each wallet and a
//  leg that would slip past its minOut is refunded by the pool to that wallet.
//
//  Selling from many wallets cannot be done by a contract (each wallet must
//  sign its own jetton transfer); the app's local multi-wallet signer does that.
// ═══════════════════════════════════════════════════════════════════════════

const LEG_GAS: Int = ton("0.12");   // BUY_GAS (0.1) + forwarding fees
const MAX_LEGS: Int = 100;

contract BitpadBundler with Ownable {
    owner: Address;
    feeWallet: Address;
    feeBps: Int as uint16;

    init(owner: Address, feeWallet: Address, feeBps: Int) {
        self.owner = owner;
        self.feeWallet = feeWallet;
        self.feeBps = feeBps;
    }

    receive() {}

    receive(msg: BundleBuy) {
        let ctx: Context = context();
        require(msg.count > 0 && msg.count <= MAX_LEGS, "1–100 legs");
        let total: Int = 0;
        let n: Int = 0;
        foreach (k, leg in msg.legs) {
            require(leg.amount > 0, "Empty leg");
            total += leg.amount;
            n += 1;
        }
        require(n == msg.count, "Leg count mismatch");
        let fee: Int = total * self.feeBps / 10000;
        let needed: Int = total + n * LEG_GAS + fee + ton("0.02");
        require(ctx.value >= needed, "Insufficient value");

        foreach (k, leg in msg.legs) {
            send(SendParameters{
                to: msg.pool,
                value: leg.amount + BUY_GAS,
                mode: SendPayGasSeparately,
                bounce: true,
                body: BuyTon{ queryId: msg.queryId, amountIn: leg.amount, minOut: leg.minOut, recipient: leg.recipient, referrer: msg.referrer }.toCell()
            });
        }
        if (fee > 0) {
            send(SendParameters{ to: self.feeWallet, value: fee, mode: SendPayGasSeparately | SendIgnoreErrors, bounce: false, body: "Bitpad bundle fee".asComment() });
        }
        let excess: Int = ctx.value - needed;
        if (excess > ton("0.01")) {
            send(SendParameters{ to: ctx.sender, value: excess, mode: SendIgnoreErrors, bounce: false, body: "Bitpad: excess returned".asComment() });
        }
    }

    /// A leg bounced (e.g. the pool address was wrong). TON stays here and the
    /// owner can return it; the bounced body doesn't carry the original sender.
    bounced(msg: bounced<BuyTon>) {}

    receive(msg: SetFeeWallet) {
        self.requireOwner();
        self.feeWallet = msg.wallet;
    }

    receive(msg: Withdraw) {
        self.requireOwner();
        require(msg.amount <= myBalance() - ton("0.05"), "Exceeds balance");
        send(SendParameters{ to: self.owner, value: msg.amount, mode: SendPayGasSeparately, bounce: false });
    }

    get fun fee_bps(): Int { return self.feeBps; }
}
