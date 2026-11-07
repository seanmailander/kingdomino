import { describe, it, expect } from "vitest";
import { GameSession, Player, findPlacementWithin5x5, PICK_MADE } from "kingdomino-engine";
import type { CardId, BoardGrid, SeedProvider } from "kingdomino-engine";
import type { PlayerActor, PlacementResult } from "./player.actor";
import { GameDriver } from "./game.driver";

/** Simple seed provider that returns incrementing numbers as seeds. */
function makeTestSeedProvider(): SeedProvider {
  let i = 0;
  return { nextSeed: async () => String(i++) };
}

/**
 * A scripted PlayerActor that always picks the first available card and finds
 * the first valid in-bounds placement using the engine's own helper.
 * Falls back to { discard: true } only when no valid placement exists.
 */
function makeScriptedActor(playerId: string): PlayerActor {
  return {
    playerId,
    awaitPick: async (available: CardId[], _board: BoardGrid) => available[0],
    awaitPlacement: async (cardId: CardId, board: BoardGrid): Promise<PlacementResult> => {
      const placement = findPlacementWithin5x5(board, cardId);
      return placement ?? { discard: true };
    },
    destroy: () => {},
  };
}

describe("GameDriver", () => {
  it("runs a complete 2-player game and resolves when game:ended fires", async () => {
    const session = new GameSession({ variant: "standard", seedProvider: makeTestSeedProvider() });
    const alice = new Player("alice");
    const bob = new Player("bob");
    session.addPlayer(alice);
    session.addPlayer(bob);

    const actors = new Map([
      ["alice", makeScriptedActor("alice")],
      ["bob",   makeScriptedActor("bob")],
    ]);

    const driver = new GameDriver(session, actors);
    const finished = driver.driveUntilEnd();
    session.startGame();

    await expect(finished).resolves.toBeUndefined();
  });

  it("rejects when an actor throws during awaitPick", async () => {
    const session = new GameSession({ variant: "standard", seedProvider: makeTestSeedProvider() });
    const alice = new Player("alice");
    const bob = new Player("bob");
    session.addPlayer(alice);
    session.addPlayer(bob);

    const brokenActor: PlayerActor = {
      playerId: "alice",
      awaitPick: async () => { throw new Error("actor failed"); },
      awaitPlacement: async () => ({ discard: true }),
      destroy: () => {},
    };

    const actors = new Map([
      ["alice", brokenActor],
      ["bob",   makeScriptedActor("bob")],
    ]);

    const driver = new GameDriver(session, actors);
    const finished = driver.driveUntilEnd();
    session.startGame();

    await expect(finished).rejects.toThrow("actor failed");
  });

  it("does not ask actors for moves while the game is paused", async () => {
    const session = new GameSession({ variant: "standard", seedProvider: makeTestSeedProvider() });
    session.addPlayer(new Player("alice"));
    session.addPlayer(new Player("bob"));

    let pausedOnce = false;
    const pauseOnFirstPick = (id: string): PlayerActor => ({
      ...makeScriptedActor(id),
      awaitPick: async (available: CardId[]) => {
        if (!pausedOnce) {
          pausedOnce = true;
          session.pause();
        }
        return available[0];
      },
    });
    const actors = new Map([
      ["alice", pauseOnFirstPick("alice")],
      ["bob", pauseOnFirstPick("bob")],
    ]);

    let picks = 0;
    session.events.on(PICK_MADE, () => picks++);
    const finished = new GameDriver(session, actors).driveUntilEnd();
    session.startGame();

    await new Promise((r) => setTimeout(r, 20));
    expect(picks).toBe(1);

    session.resume();
    await expect(finished).resolves.toBeUndefined();
  });
});
