import { describe, it, expect } from "vitest";
import { GameSession, Player, findPlacementWithin5x5 } from "kingdomino-engine";
import type { CardId, BoardGrid } from "kingdomino-engine";
import type { PlayerActor, PlacementResult } from "./player.actor";
import { GameDriver } from "./game.driver";

/**
 * A scripted PlayerActor that always picks the first available card and finds
 * the first valid in-bounds placement using the engine's own helper.
 * Falls back to { discard: true } only when no valid placement exists.
 * This is safe to use across multiple rounds on the same board.
 *
 * NOTE: handleDiscard() in the engine throws if a valid placement exists,
 * so the actor MUST use findPlacementWithin5x5 and only discard as fallback.
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
    const session = new GameSession({ variant: "standard" });
    const alice = new Player("alice");
    const bob = new Player("bob");
    session.addPlayer(alice);
    session.addPlayer(bob);

    const actors = new Map([
      ["alice", makeScriptedActor("alice")],
      ["bob",   makeScriptedActor("bob")],
    ]);

    const driver = new GameDriver(session, actors);
    session.startGame();

    await expect(driver.run()).resolves.toBeUndefined();
  });

  it("rejects when an actor throws during awaitPick", async () => {
    const session = new GameSession({ variant: "standard" });
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
    session.startGame();

    await expect(driver.run()).rejects.toThrow("actor failed");
  });
});
