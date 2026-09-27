import "./messages";

const MIN_TON_FOR_STORAGE: Int = ton("0.01");
const GAS_CONSUMPTION: Int = ton("0.015");

/// Fixed-supply jetton minted exactly once by the factory, then renounced
/// (admin = factory, which exposes no mint path afterwards).
contract BitpadJetton {
    factory: Address;
    index: Int as uint64;
    totalSupply: Int as coins = 0;
    minted: Bool = false;
    content: Cell;
    creator: Address;
    pair: Address?;

    init(factory: Address, index: Int, content: Cell, creator: Address, pair: Address?) {
        self.factory = factory;
        self.index = index;
        self.content = content;
        self.creator = creator;
        self.pair = pair;
    }

    receive(msg: MintAll) {
        require(sender() == self.factory, "Only factory");
        require(!self.minted, "Already minted");
        self.minted = true;
        self.totalSupply = msg.amount;
        let init: StateInit = initOf BitpadJettonWallet(msg.receiver, myAddress());
        send(SendParameters{
            to: contractAddress(init),
            value: 0,
            bounce: false,
            mode: SendRemainingValue,
            body: TokenTransferInternal{
                queryId: msg.queryId,
                amount: msg.amount,
                from: myAddress(),
                responseDestination: msg.receiver,
                forwardTonAmount: 0,
                forwardPayload: emptySlice()
            }.toCell(),
            code: init.code,
            data: init.data
        });
    }

    receive(msg: TokenBurnNotification) {
        let init: StateInit = initOf BitpadJettonWallet(msg.sender, myAddress());
        require(sender() == contractAddress(init), "Invalid sender");
        self.totalSupply -= msg.amount;
        if (msg.responseDestination != null) {
            send(SendParameters{
                to: msg.responseDestination!!,
                value: 0,
                bounce: false,
                mode: SendRemainingValue | SendIgnoreErrors,
                body: TokenExcesses{ queryId: msg.queryId }.toCell()
            });
        }
    }

    receive(msg: ProvideWalletAddress) {
        require(context().value >= ton("0.0061"), "Insufficient gas");
        let init: StateInit = initOf BitpadJettonWallet(msg.ownerAddress, myAddress());
        let owner: Cell? = msg.includeAddress ? beginCell().storeAddress(msg.ownerAddress).endCell() : null;
        send(SendParameters{
            to: sender(),
            value: 0,
            mode: SendRemainingValue,
            body: TakeWalletAddress{ queryId: msg.queryId, walletAddress: contractAddress(init), ownerAddress: owner }.toCell()
        });
    }

    get fun get_jetton_data(): JettonData {
        return JettonData{
            totalSupply: self.totalSupply,
            mintable: !self.minted,
            owner: self.factory,
            content: self.content,
            walletCode: initOf BitpadJettonWallet(myAddress(), myAddress()).code
        };
    }

    get fun get_wallet_address(owner: Address): Address {
        return contractAddress(initOf BitpadJettonWallet(owner, myAddress()));
    }

    get fun bitpad_info(): Cell {
        let b: Builder = beginCell().storeAddress(self.creator).storeUint(self.index, 64);
        if (self.pair != null) {
            return b.storeBit(true).storeAddress(self.pair!!).endCell();
        }
        return b.storeBit(false).endCell();
    }
}

contract BitpadJettonWallet {
    balance: Int as coins = 0;
    owner: Address;
    master: Address;

    init(owner: Address, master: Address) {
        self.owner = owner;
        self.master = master;
    }

    receive(msg: TokenTransfer) {
        let ctx: Context = context();
        require(ctx.sender == self.owner, "Invalid sender");
        let fwdCount: Int = msg.forwardTonAmount > 0 ? 2 : 1;
        require(ctx.value > msg.forwardTonAmount + fwdCount * ctx.readForwardFee() + 2 * GAS_CONSUMPTION + MIN_TON_FOR_STORAGE, "Insufficient TON");
        self.balance -= msg.amount;
        require(self.balance >= 0, "Insufficient balance");
        let init: StateInit = initOf BitpadJettonWallet(msg.destination, self.master);
        send(SendParameters{
            to: contractAddress(init),
            value: 0,
            mode: SendRemainingValue,
            bounce: true,
            body: TokenTransferInternal{
                queryId: msg.queryId,
                amount: msg.amount,
                from: self.owner,
                responseDestination: msg.responseDestination,
                forwardTonAmount: msg.forwardTonAmount,
                forwardPayload: msg.forwardPayload
            }.toCell(),
            code: init.code,
            data: init.data
        });
    }

    receive(msg: TokenTransferInternal) {
        let ctx: Context = context();
        if (ctx.sender != self.master) {
            let sinit: StateInit = initOf BitpadJettonWallet(msg.from, self.master);
            require(contractAddress(sinit) == ctx.sender, "Invalid sender");
        }
        self.balance += msg.amount;
        let msgValue: Int = ctx.value;
        let tonBalanceBeforeMsg: Int = myBalance() - msgValue;
        let storageFee: Int = MIN_TON_FOR_STORAGE - min(tonBalanceBeforeMsg, MIN_TON_FOR_STORAGE);
        msgValue -= (storageFee + GAS_CONSUMPTION);
        if (msg.forwardTonAmount > 0) {
            msgValue -= (msg.forwardTonAmount + ctx.readForwardFee());
            send(SendParameters{
                to: self.owner,
                value: msg.forwardTonAmount,
                mode: SendPayGasSeparately,
                bounce: false,
                body: TokenNotification{ queryId: msg.queryId, amount: msg.amount, from: msg.from, forwardPayload: msg.forwardPayload }.toCell()
            });
        }
        if (msg.responseDestination != null && msgValue > 0) {
            send(SendParameters{
                to: msg.responseDestination!!,
                value: msgValue,
                bounce: false,
                mode: SendIgnoreErrors,
                body: TokenExcesses{ queryId: msg.queryId }.toCell()
            });
        }
    }

    receive(msg: TokenBurn) {
        let ctx: Context = context();
        require(ctx.sender == self.owner, "Invalid sender");
        self.balance -= msg.amount;
        require(self.balance >= 0, "Insufficient balance");
        require(ctx.value > ctx.readForwardFee() + 2 * GAS_CONSUMPTION + MIN_TON_FOR_STORAGE, "Insufficient TON");
        send(SendParameters{
            to: self.master,
            value: 0,
            mode: SendRemainingValue,
            bounce: true,
            body: TokenBurnNotification{ queryId: msg.queryId, amount: msg.amount, sender: self.owner, responseDestination: msg.responseDestination }.toCell()
        });
    }

    bounced(src: bounced<TokenTransferInternal>) {
        self.balance += src.amount;
    }

    bounced(src: bounced<TokenBurnNotification>) {
        self.balance += src.amount;
    }

    get fun get_wallet_data(): JettonWalletData {
        return JettonWalletData{ balance: self.balance, owner: self.owner, master: self.master, code: initOf BitpadJettonWallet(self.owner, self.master).code };
    }
}
