import "./messages";
import "./jetton";

// ═══════════════════════════════════════════════════════════════════════════
//  StakeVault — one per launch, deployed by its pool at launch.
//
//  • Stake: transfer the jetton to the vault (a plain jetton transfer with
//    ≥ 0.05 TON forwarded). Unstake any amount, any time.
//  • Rewards are TON. The pool sends a share of its protocol and creator fees
//    on every ClaimFees; anyone may also top up with StakeRewards.
//  • Each reward is split pro-rata to the jettons staked at that moment
//    (reward-per-share accumulator). TON that arrives while nothing is staked
//    is carried to the next reward.
// ═══════════════════════════════════════════════════════════════════════════

const PRECISION: Int = 1000000000000000000;  // 1e18
const VAULT_GAS: Int = ton("0.01");          // kept from each reward for compute
const VAULT_STORAGE: Int = ton("0.05");
const MIN_STAKE_FWD: Int = ton("0.05");

contract StakeVault {
    pool: Address;
    tokenMaster: Address;
    tokenWallet: Address;
    totalStaked: Int as coins = 0;
    stakerCount: Int as uint32 = 0;
    accPerShare: Int = 0;
    rewardsTotal: Int as coins = 0;
    carry: Int as coins = 0;
    owed: Int as coins = 0;          // Σ TON owed to stakers (earned, unpaid)
    stakers: map<Address, StakerInfo>;

    init(pool: Address, tokenMaster: Address) {
        self.pool = pool;
        self.tokenMaster = tokenMaster;
        self.tokenWallet = contractAddress(initOf BitpadJettonWallet(myAddress(), tokenMaster));
    }

    /// Deploy ping from the pool / plain top-ups for rent
    receive() {}

    receive(msg: StakeRewards) {
        let amount: Int = context().value - VAULT_GAS;
        if (amount <= 0) {
            return;
        }
        if (self.totalStaked == 0) {
            self.carry += amount;
            return;
        }
        let r: Int = amount + self.carry;
        self.carry = 0;
        self.accPerShare += r * PRECISION / self.totalStaked;
        self.rewardsTotal += r;
        self.owed += r;
    }

    // Stake: our jetton wallet tells us someone sent jettons
    receive(msg: TokenNotification) {
        let ctx: Context = context();
        if (ctx.sender != self.tokenWallet || ctx.value < MIN_STAKE_FWD - ton("0.01")) {
            // Not our jetton (or no gas to track it): hand it back
            send(SendParameters{ to: ctx.sender, value: 0, mode: SendRemainingValue, bounce: false, body: jettonTransfer(msg.queryId, msg.amount, msg.from, msg.from, 0) });
            return;
        }
        let s: StakerInfo = self.settle(msg.from);
        if (s.amount == 0) {
            self.stakerCount += 1;
        }
        s.amount += msg.amount;
        s.debt = s.amount * self.accPerShare / PRECISION;
        self.totalStaked += msg.amount;
        self.stakers.set(msg.from, s);
        // A stake landing while TON is carried: distribute it to the new stake
        if (self.carry > 0) {
            let r: Int = self.carry;
            self.carry = 0;
            self.accPerShare += r * PRECISION / self.totalStaked;
            self.rewardsTotal += r;
            self.owed += r;
        }
    }

    receive(msg: Unstake) {
        let who: Address = sender();
        let s: StakerInfo = self.settle(who);
        require(msg.amount > 0 && msg.amount <= s.amount, "Not enough staked");
        require(context().value >= ton("0.08"), "Attach 0.1 TON");
        s.amount -= msg.amount;
        s.debt = s.amount * self.accPerShare / PRECISION;
        self.totalStaked -= msg.amount;
        let pay: Int = s.pending;
        s.pending = 0;
        self.owed -= pay;
        if (s.amount == 0) {
            self.stakerCount -= 1;
            self.stakers.set(who, null);
        } else {
            self.stakers.set(who, s);
        }
        if (pay > 0) {
            send(SendParameters{ to: who, value: pay, mode: SendPayGasSeparately, bounce: false, body: "Bitpad staking rewards".asComment() });
        }
        // Jettons back; unused gas returns to the staker as excess
        send(SendParameters{ to: self.tokenWallet, value: 0, mode: SendRemainingValue, bounce: true, body: jettonTransfer(msg.queryId, msg.amount, who, who, 0) });
    }

    receive(msg: ClaimRewards) {
        let who: Address = sender();
        let s: StakerInfo = self.settle(who);
        require(s.pending > 0, "Nothing to claim");
        let pay: Int = s.pending;
        s.pending = 0;
        self.owed -= pay;
        self.stakers.set(who, s);
        send(SendParameters{ to: who, value: pay, mode: SendRemainingValue, bounce: false, body: "Bitpad staking rewards".asComment() });
    }

    /// A jetton transfer back to a staker bounced: nothing left the vault, so
    /// keep the jettons staked as unattributed until support recovers them.
    bounced(msg: bounced<TokenTransfer>) {
        self.totalStaked += msg.amount;
    }

    /// Move everything earned since the last update into `pending`.
    fun settle(who: Address): StakerInfo {
        let s: StakerInfo? = self.stakers.get(who);
        if (s == null) {
            return StakerInfo{ amount: 0, debt: 0, pending: 0 };
        }
        let x: StakerInfo = s!!;
        let earned: Int = x.amount * self.accPerShare / PRECISION - x.debt;
        x.pending += earned;
        x.debt = x.amount * self.accPerShare / PRECISION;
        return x;
    }

    // ── Getters ────────────────────────────────────────────────────────────

    get fun vault_data(): VaultData {
        return VaultData{
            pool: self.pool,
            tokenMaster: self.tokenMaster,
            tokenWallet: self.tokenWallet,
            totalStaked: self.totalStaked,
            stakers: self.stakerCount,
            accPerShare: self.accPerShare,
            rewardsTotal: self.rewardsTotal,
            carry: self.carry
        };
    }

    /// Staked amount and claimable TON for `a` (0, 0 when not staking).
    get fun staker(a: Address): StakerInfo {
        let s: StakerInfo? = self.stakers.get(a);
        if (s == null) {
            return StakerInfo{ amount: 0, debt: 0, pending: 0 };
        }
        let x: StakerInfo = s!!;
        return StakerInfo{ amount: x.amount, debt: x.debt, pending: x.pending + x.amount * self.accPerShare / PRECISION - x.debt };
    }
}
