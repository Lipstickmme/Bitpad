import "@stdlib/ownable";
import "./messages";
import "./jetton";

/// Deploys fixed-supply jettons for Bitpad launches, mints the full supply to
/// the creator (who then seeds a STON.fi pool against the chosen pair asset),
/// and forwards the launch fee to the fee wallet.
contract BitpadFactory with Ownable {
    owner: Address;
    feeWallet: Address;
    launchFee: Int as coins;
    launches: Int as uint64 = 0;

    init(owner: Address, feeWallet: Address, launchFee: Int) {
        self.owner = owner;
        self.feeWallet = feeWallet;
        self.launchFee = launchFee;
    }

    // Plain TON transfers (deploy, top-ups for storage)
    receive() {}

    receive(msg: Launch) {
        let ctx: Context = context();
        let deployValue: Int = ton("0.2");
        require(ctx.value >= self.launchFee + deployValue + ton("0.05"), "Insufficient value");
        require(msg.supply > 0, "Zero supply");

        let init: StateInit = initOf BitpadJetton(myAddress(), self.launches, msg.content, ctx.sender, msg.pair);
        let minter: Address = contractAddress(init);

        if (self.launchFee > 0) {
            send(SendParameters{ to: self.feeWallet, value: self.launchFee, mode: SendIgnoreErrors, bounce: false });
        }
        send(SendParameters{
            to: minter,
            value: ctx.value - self.launchFee - ton("0.05"),
            mode: SendPayGasSeparately,
            bounce: false,
            code: init.code,
            data: init.data,
            body: MintAll{ queryId: msg.queryId, amount: msg.supply, receiver: ctx.sender }.toCell()
        });
        emit(Launched{ index: self.launches, minter: minter, creator: ctx.sender, supply: msg.supply, pair: msg.pair }.toCell());
        self.launches += 1;
    }

    receive(msg: SetLaunchFee) {
        self.requireOwner();
        self.launchFee = msg.fee;
    }

    receive(msg: SetFeeWallet) {
        self.requireOwner();
        self.feeWallet = msg.wallet;
    }

    get fun launch_count(): Int {
        return self.launches;
    }

    get fun launch_fee(): Int {
        return self.launchFee;
    }

    /// Address of the minter for launch #index by `creator` with `content`.
    get fun minter_address(index: Int, content: Cell, creator: Address, pair: Address?): Address {
        return contractAddress(initOf BitpadJetton(myAddress(), index, content, creator, pair));
    }
}
