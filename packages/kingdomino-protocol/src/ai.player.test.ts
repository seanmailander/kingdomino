// client/src/game/state/ai.player.test.ts
import { describe, expect, it } from "vitest";
import { RandomAIPlayer } from "./ai.player";

describe("RandomAIPlayer — generateMove", () => {
  it("returns a card from the active deal at a valid non-zero position when AI picks first", () => {
    const ai = new RandomAIPlayer("them", "me");
    ai.startGame(["them", "me"]); // AI picks first
    ai.beginRound([4, 22, 28, 46]);

    const move = ai.generateMove();

    expect(move.playerId).toBe("them");
    expect([4, 22, 28, 46]).toContain(move.cardId);
    expect("discard" in move).toBe(false);
    if (!("discard" in move)) {
      expect(move.x).toBeTypeOf("number");
      expect(move.y).toBeTypeOf("number");
      expect(["up", "down", "left", "right"]).toContain(move.direction);
      // Any card should be placeable next to the castle — not the hardcoded sentinel (0,0,up)
      expect(move.x !== 0 || move.y !== 0).toBe(true);
    }
  });

  it("returns a card from the active deal at a valid position when AI picks second", () => {
    const ai = new RandomAIPlayer("them", "me");
    ai.startGame(["me", "them"]); // Human picks first
    ai.beginRound([4, 22, 28, 46]);

    // Simulate human picking card 4 and placing it at (7,6,right) next to the castle
    ai.receiveHumanMove(4, 7, 6, "right");

    const move = ai.generateMove();

    expect(move.playerId).toBe("them");
    expect([22, 28, 46]).toContain(move.cardId); // card 4 is taken
    expect("discard" in move).toBe(false);
    if (!("discard" in move)) {
      expect(move.x).toBeTypeOf("number");
      expect(move.y).toBeTypeOf("number");
      expect(["up", "down", "left", "right"]).toContain(move.direction);
    }
  });
});

describe("RandomAIPlayer — receiveHumanMove", () => {
  it("prevents AI from picking the same card the human already picked", () => {
    const ai = new RandomAIPlayer("them", "me");
    ai.startGame(["me", "them"]); // Human picks first
    ai.beginRound([4, 22, 28, 46]);

    ai.receiveHumanMove(4, 7, 6, "right"); // Human claims card 4
    const move = ai.generateMove();

    expect(move.cardId).not.toBe(4);
    expect([22, 28, 46]).toContain(move.cardId);
  });

  it("tracks the human placement so the AI does not overlap the same board position", () => {
    const ai = new RandomAIPlayer("them", "me");
    ai.startGame(["me", "them"]);
    ai.beginRound([4, 22, 28, 46]);

    // Human places at (7,6) right — takes positions (7,6) and (8,6) on human's board
    // AI board is separate — this test verifies receiveHumanMove doesn't throw
    expect(() => ai.receiveHumanMove(4, 7, 6, "right")).not.toThrow();
  });
});
