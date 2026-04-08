// packages/kingdomino-protocol/src/connection.multiplayer.test.ts
import { describe, it, expect } from "vitest";
import { MultiplayerConnection } from "./connection.multiplayer";
import { PICK, PLACE, DISCARD } from "./game.messages";

function makeConnectedPair() {
  const a = new MultiplayerConnection({ me: "a", them: "b" });
  const b = new MultiplayerConnection({ me: "b", them: "a" });
  a.setTransport({ send: (msg) => b.receive(msg) });
  b.setTransport({ send: (msg) => a.receive(msg) });
  return { a, b };
}

describe("MultiplayerConnection.waitForOneOf", () => {
  it("resolves with a PICK message when PICK arrives first", async () => {
    const { a, b } = makeConnectedPair();
    const promise = a.waitForOneOf(PICK, PLACE, DISCARD);
    b.send({ type: "pick:made", playerId: "b", cardId: 42 });
    const msg = await promise;
    expect(msg).toMatchObject({ type: "pick:made", cardId: 42 });
  });

  it("resolves with a PLACE message when PLACE arrives first", async () => {
    const { a, b } = makeConnectedPair();
    const promise = a.waitForOneOf(PICK, PLACE, DISCARD);
    b.send({ type: "place:made", playerId: "b", x: 3, y: 2, direction: "right" });
    const msg = await promise;
    expect(msg).toMatchObject({ type: "place:made", x: 3, y: 2 });
  });

  it("resolves with a DISCARD message when DISCARD arrives first", async () => {
    const { a, b } = makeConnectedPair();
    const promise = a.waitForOneOf(PICK, PLACE, DISCARD);
    b.send({ type: "discard:made", playerId: "b" });
    const msg = await promise;
    expect(msg).toMatchObject({ type: "discard:made" });
  });

  it("removes losing resolvers when one wins (no stale resolvers remain)", async () => {
    const { a, b } = makeConnectedPair();
    const promise = a.waitForOneOf(PICK, PLACE, DISCARD);
    b.send({ type: "pick:made", playerId: "b", cardId: 1 });
    await promise;

    // No stale resolvers: a second PLACE should queue, not fire a stale resolver.
    // Verify by checking that a fresh waitForOneOf for PLACE resolves correctly.
    b.send({ type: "place:made", playerId: "b", x: 0, y: 0, direction: "right" });
    const second = await a.waitForOneOf(PLACE);
    expect(second).toMatchObject({ type: "place:made" });
  });

  it("drains already-queued messages (first type wins)", async () => {
    const { a, b } = makeConnectedPair();
    // Queue a PICK before the waitForOneOf call.
    b.send({ type: "pick:made", playerId: "b", cardId: 99 });
    // Give the message time to arrive and queue.
    await Promise.resolve();
    const msg = await a.waitForOneOf(PICK, PLACE);
    expect(msg).toMatchObject({ type: "pick:made", cardId: 99 });
  });

  it("rejects when the connection is destroyed while waiting", async () => {
    const { a } = makeConnectedPair();
    const promise = a.waitForOneOf(PICK, PLACE, DISCARD);
    a.destroy();
    await expect(promise).rejects.toThrow("destroyed");
  });

  it("two-type race: waitForOneOf(PLACE, DISCARD) behaves like waitForPlaceOrDiscard", async () => {
    const { a, b } = makeConnectedPair();
    // Round 1: PLACE wins
    b.send({ type: "place:made", playerId: "b", x: 1, y: 1, direction: "up" });
    const r1 = await a.waitForOneOf(PLACE, DISCARD);
    expect(r1).toMatchObject({ type: "place:made" });

    // Round 2: DISCARD wins — if stale resolver from round 1 existed, it would eat this
    b.send({ type: "discard:made", playerId: "b" });
    const r2 = await a.waitForOneOf(PLACE, DISCARD);
    expect(r2).toMatchObject({ type: "discard:made" });
  });
});
