import { describe, expect, it } from "vitest";

import { right, left } from "kingdomino-engine";
import { CommitmentSeedProvider } from "kingdomino-commitment";
import type { CommitmentTransport } from "kingdomino-commitment";
import { TestConnection } from "./connection.testing";

/** Adapts TestConnection to CommitmentTransport for CommitmentSeedProvider */
function asTransport(connection: TestConnection): CommitmentTransport {
  return connection as unknown as CommitmentTransport;
}

describe("TestConnection", () => {
  it("CommitmentSeedProvider + TestConnection: nextSeed() resolves to a string", async () => {
    const connection = new TestConnection({
      scenario: {
        handshakes: [{ secret: 101 }],
        moves: [],
      },
    });
    const provider = new CommitmentSeedProvider(asTransport(connection));

    await expect(provider.nextSeed()).resolves.toEqual(expect.any(String));
  });

  it("fails loudly when a scripted commitment does not match its reveal", async () => {
    const connection = new TestConnection({
      scenario: {
        handshakes: [{ secret: 101, committment: "not-the-real-hash" }],
        moves: [],
      },
    });
    const provider = new CommitmentSeedProvider(asTransport(connection));

    await expect(provider.nextSeed()).rejects.toThrow(
      "Remote commitment verification failed",
    );
  });

  it("queues the scripted remote pick and place for each round handshake after the opening seed", async () => {
    const connection = new TestConnection({
      me: "local-player",
      them: "remote-player",
      scenario: {
        handshakes: [{ secret: 101 }, { secret: 202 }, { secret: 303 }],
        moves: [
          { card: 26, x: 5, y: 6, direction: left },
          { card: 18, x: 7, y: 6, direction: right },
        ],
      },
    });
    const provider = new CommitmentSeedProvider(asTransport(connection));

    await provider.nextSeed(); // pick-order seed (no move emitted)
    await provider.nextSeed(); // round 1 seed (move 0 emitted)
    await expect(connection.waitFor("pick:made")).resolves.toEqual({
      type: "pick:made", playerId: "remote-player", cardId: 26,
    });
    await expect(connection.waitFor("place:made")).resolves.toEqual({
      type: "place:made", playerId: "remote-player", x: 5, y: 6, direction: left,
    });

    await provider.nextSeed(); // round 2 seed (move 1 emitted)
    await expect(connection.waitFor("pick:made")).resolves.toEqual({
      type: "pick:made", playerId: "remote-player", cardId: 18,
    });
    await expect(connection.waitFor("place:made")).resolves.toEqual({
      type: "place:made", playerId: "remote-player", x: 7, y: 6, direction: right,
    });
  });

  it("throws when a round handshake has no scripted remote move available", async () => {
    const connection = new TestConnection({
      scenario: {
        handshakes: [{ secret: 101 }, { secret: 202 }],
        moves: [],
      },
    });
    const provider = new CommitmentSeedProvider(asTransport(connection));

    await provider.nextSeed(); // pick-order seed
    await expect(provider.nextSeed()).rejects.toThrow(
      "TestConnection scenario has no scripted move for round 1",
    );
  });
});
