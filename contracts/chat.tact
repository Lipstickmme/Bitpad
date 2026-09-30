// ═══════════════════════════════════════════════════════════════════════════
//  TrenchChat — Bitpad's on-chain chat room.
//
//  A post is simply a message to this contract; its body (kind, parent, token,
//  text, media — layout in src/lib/chat.ts) is the permanent record, read back
//  from the contract's transaction history. Nothing is parsed or stored here,
//  which keeps each post to the minimum compute fee. The attached TON above
//  gas stays in the contract; the owner can sweep it.
// ═══════════════════════════════════════════════════════════════════════════

contract TrenchChat(owner: Address) {
    receive() {}

    /// Posts, replies, likes and calls: any body is accepted and recorded.
    receive(msg: Slice) {}

    receive("withdraw") {
        require(sender() == self.owner, "Only owner");
        nativeReserve(ton("0.05"), ReserveExact);
        send(SendParameters{ to: self.owner, value: 0, mode: SendRemainingBalance, bounce: false, body: "TrenchChat sweep".asComment() });
    }

    get fun owner(): Address {
        return self.owner;
    }
}
