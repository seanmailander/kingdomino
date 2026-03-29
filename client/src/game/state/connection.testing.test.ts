import { describe, expect, it, vi } from "vitest";

import { right, left } from "kingdomino-engine";
import { hashIt } from "kingdomino-engine";
import { ConnectionManager } from "./ConnectionManager";
import { TestConnection } from "./connection.testing";

const HANDSHAKE_LOCAL_SECRET = 7;
const HANDSHAKE_REMOTE_SECRET = 101;

describe("TestConnection", () => {
  it("produces a stable combined seed for fixed secrets (snapshot — run updateSnapshot on intentional RNG changes)", async () => {
    // Snapshot the output of buildTrustedSeed with a fixed seed to catch changes to RNG
    const localCommit = async () => ({
      secret: HANDSHAKE_LOCAL_SECRET,
      committment: await hashIt(HANDSHAKE_LOCAL_SECRET),
    });
    const connection = new TestConnection({
      scenario: { handshakes: [{ secret: HANDSHAKE_REMOTE_SECRET }], moves: [] },
    });
    const manager = new ConnectionManager(connection.send, connection.waitFor, { commit: localCommit });
    expect(await manager.buildTrustedSeed()).toMatchSnapshot();
  });

  it("satisfies the trusted-seed handshake through ConnectionManager", async () => {
    const connection = new TestConnection({
      scenario: {
        handshakes: [{ secret: 101 }],
        moves: [],
      },
    });
    const manager = new ConnectionManager(connection.send, connection.waitFor);

    await expect(manager.buildTrustedSeed()).resolves.toEqual(expect.any(String));
  });

  it("uses an injected local commit function for deterministic handshake control", async () => {
    const localCommit = vi.fn(async () => ({ secret: 7, committment: await hashIt(7) }));
    const connection = new TestConnection({
      scenario: {
        handshakes: [{ secret: 101 }],
        moves: [],
      },
    });
    const manager = new ConnectionManager(connection.send, connection.waitFor, {
      commit: localCommit,
    });

    await manager.buildTrustedSeed();

    expect(localCommit).toHaveBeenCalledOnce();
  });

  it("fails loudly when a scripted commitment does not match its reveal", async () => {
    const connection = new TestConnection({
      scenario: {
        handshakes: [{ secret: 101, committment: "not-the-real-hash" }],
        moves: [],
      },
    });
    const manager = new ConnectionManager(connection.send, connection.waitFor);

    await expect(manager.buildTrustedSeed()).rejects.toThrow(
      "Remote committment verification failed",
    );
  });

  it("queues the scripted remote move for each round handshake after the opening seed", async () => {
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
    const manager = new ConnectionManager(connection.send, connection.waitFor);

    await manager.buildTrustedSeed();
    await manager.buildTrustedSeed();
    await expect(manager.waitForMove()).resolves.toEqual({
      move: { playerId: "remote-player", card: 26, x: 5, y: 6, direction: left },
    });

    await manager.buildTrustedSeed();
    await expect(manager.waitForMove()).resolves.toEqual({
      move: { playerId: "remote-player", card: 18, x: 7, y: 6, direction: right },
    });
  });

  it("throws when a round handshake has no scripted remote move available", async () => {
    const connection = new TestConnection({
      scenario: {
        handshakes: [{ secret: 101 }, { secret: 202 }],
        moves: [],
      },
    });
    const manager = new ConnectionManager(connection.send, connection.waitFor);

    await manager.buildTrustedSeed();
    await expect(manager.buildTrustedSeed()).rejects.toThrow(
      "TestConnection scenario has no scripted move for round 1",
    );
  });
});
