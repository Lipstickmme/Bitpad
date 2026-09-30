import { test } from "node:test";
import assert from "node:assert/strict";
import { Blockchain } from "@ton/sandbox";
import { Address, Cell, toNano } from "@ton/core";
import { TrenchChat } from "../contracts/build/TrenchChat_TrenchChat";
import { chatAddress, chatInit, decodePost, encodePost, POST_VALUE } from "../src/lib/chat";

const TOKEN = "EQCxE6mUtQJKFnGfaROTKOt1lZbDiiX1kCixRv7Nw2Id_sDs";
const HASH = "ab".repeat(32);

test("chat: committed code matches the build; posts round-trip; contract accepts and stays cheap", async () => {
  const chain = await Blockchain.create();
  const owner = await chain.treasury("owner");
  const alice = await chain.treasury("alice");
  const built = await TrenchChat.init(owner.address);
  assert.ok(chatInit(owner.address).code.equals(built.code), "src/lib/chat.ts CHAT_CODE_HEX is stale — copy the new code from contracts/build");
  assert.ok(chatAddress(owner.address).equals((await TrenchChat.fromInit(owner.address)).address));

  // round trips
  const png = Uint8Array.from([0x89, 0x50, 0x4e, 0x47, ...Array(400).fill(7)]);
  const cases = [
    { kind: "post" as const, text: "gm $AAPLx 🚀", media: null },
    { kind: "reply" as const, parent: HASH, text: "wagmi", media: { type: "sticker" as const, id: "lfg" } },
    { kind: "call" as const, token: TOKEN, text: "thesis: …".repeat(20), media: { type: "gif" as const, url: "https://media.giphy.com/media/x/giphy.gif" } },
    { kind: "post" as const, text: "pic", media: { type: "image" as const, bytes: png } },
  ];
  for (const c of cases) {
    const d = decodePost(encodePost(c))!;
    assert.equal(d.kind, c.kind);
    assert.equal(d.text, c.text);
    if ("parent" in c) assert.equal(d.parent, HASH);
    if ("token" in c) assert.ok(Address.parse(d.token!).equals(Address.parse(TOKEN)));
  }
  assert.equal(decodePost(encodePost(cases[3]))!.media!.type, "image");
  assert.throws(() => encodePost({ kind: "post", text: "x", media: { type: "gif", url: "https://evil.example/x.gif" } }), /Giphy or Tenor/);
  assert.equal(decodePost(Cell.EMPTY), null);

  // on-chain: first post deploys the room via stateInit; later posts are plain messages
  const init = chatInit(owner.address);
  const room = chatAddress(owner.address);
  const r1 = await alice.send({ to: room, value: POST_VALUE, init, body: encodePost(cases[0]), bounce: false });
  const r2 = await alice.send({ to: room, value: POST_VALUE, body: encodePost(cases[2]), bounce: true });
  for (const r of [r1, r2]) {
    const tx = r.transactions.find((t) => t.inMessage?.info.dest?.toString() === room.toString())!;
    assert.equal(tx.description.type, "generic");
    const d = tx.description as { computePhase: { type: string; success?: boolean; gasFees?: bigint }; aborted: boolean };
    assert.equal(d.aborted, false, "post accepted");
    if (d.computePhase.type === "vm") assert.ok(d.computePhase.gasFees! < POST_VALUE, `compute ${d.computePhase.gasFees} fits in the attached value`);
  }
  // only the owner can sweep
  const room$ = chain.openContract(TrenchChat.fromAddress(room));
  const bad = await room$.send(alice.getSender(), { value: toNano("0.05") }, "withdraw");
  assert.ok(bad.transactions.some((t) => t.description.type === "generic" && t.description.computePhase.type === "vm" && !t.description.computePhase.success));
});
