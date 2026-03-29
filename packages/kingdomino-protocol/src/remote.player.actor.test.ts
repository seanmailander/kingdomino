import { describe, it, expect } from "vitest";
import { MultiplayerConnection } from "./connection.multiplayer";
import { ConnectionManager } from "./ConnectionManager";
import { RemotePlayerActor } from "./remote.player.actor";
import type { BoardGrid } from "kingdomino-engine";

/**
 * Wire two MultiplayerConnections together so that messages sent on one
 * arrive on the other, simulating two peers communicating over the wire.
 */
function makeConnectedPair() {
  const a = new MultiplayerConnection({ me: "local", them: "remote" });
  const b = new MultiplayerConnection({ me: "remote", them: "local" });
  a.setTransport({ send: (msg) => b.receive(msg) });
  b.setTransport({ send: (msg) => a.receive(msg) });
  return { local: a, remote: b };
}

// A minimal BoardGrid stand-in; the actor ignores it for remote moves.
const stubBoard = {} as BoardGrid;

describe("RemotePlayerActor", () => {
  it("awaitPick() resolves with the card ID from the peer's PICK message", async () => {
    const { local, remote } = makeConnectedPair();
    const manager = new ConnectionManager(local.send, local.waitFor);
    const actor = new RemotePlayerActor("remote", manager);

    // Peer sends a pick message
    remote.send({ type: "pick:made", playerId: "remote", cardId: 42 });

    const cardId = await actor.awaitPick([4, 22, 42], stubBoard);
    expect(cardId).toBe(42);
  });

  it("awaitPlacement() resolves with x/y/direction from a PLACE message", async () => {
    const { local, remote } = makeConnectedPair();
    const manager = new ConnectionManager(local.send, local.waitFor);
    const actor = new RemotePlayerActor("remote", manager);

    remote.send({ type: "place:made", playerId: "remote", x: 7, y: 6, direction: "right" });

    const result = await actor.awaitPlacement(42, stubBoard);
    expect(result).toEqual({ x: 7, y: 6, direction: "right" });
  });

  it("awaitPlacement() resolves with { discard: true } from a DISCARD message", async () => {
    const { local, remote } = makeConnectedPair();
    const manager = new ConnectionManager(local.send, local.waitFor);
    const actor = new RemotePlayerActor("remote", manager);

    remote.send({ type: "discard:made", playerId: "remote" });

    const result = await actor.awaitPlacement(42, stubBoard);
    expect(result).toEqual({ discard: true });
  });

  it("destroy() does not throw", () => {
    const { local } = makeConnectedPair();
    const manager = new ConnectionManager(local.send, local.waitFor);
    const actor = new RemotePlayerActor("remote", manager);
    expect(() => actor.destroy()).not.toThrow();
  });
});
