// Section 3 — Scoring (Logic)
//
// Board.score() uses BFS per terrain region: score = Σ(regionSize × regionCrowns).
// Castle (tile === 0) and empty cells are skipped.
//
// Selected card ids (0-indexed):
//   0  grain/grain       — no crowns
//   1  grain/grain       — no crowns
//   2  wood/wood         — no crowns
//   3  wood/wood         — no crowns
//   6  water/water       — no crowns
//   9  grass/grass       — no crowns
//  18  grain(1cr)/wood   — crown on tileA  [secondTwelve[6]: getTile(grain, wood, oneCrown)]
//  44  mine(2cr)/grain   — crown on tileA  [fourthTwelve[8]: getTile(mine, grain, twoCrown)]
//  46  marsh/mine(2cr)   — crown on tileB  [fourthTwelve[10]: getTile(marsh, mine, _, twoCrown)]
import { describe, expect, it } from "vitest";
import { Board } from "../state/Board";
import { GameSession, Player } from "../state/GameSession";
import type { GameEventMap } from "../state/GameSession";
import { right, left, down, up } from "kingdomino-engine";
import {
  scoreBoard,
  largestRegion,
  totalCrowns as totalCrownsGrid,
  isCastleCentered as isCastleCenteredGrid,
} from "kingdomino-engine";

describe("Pure scoring functions in gamelogic/board", () => {
  it("scoreBoard returns 0 for an empty board", () => {
    expect(scoreBoard(new Board().snapshot())).toBe(0);
  });

  it("scoreBoard computes region-size × crown-count", () => {
    // card 0: grain/grain at (7,6)right, card 18: grain(1cr)/wood at (9,6)right
    // 3-cell grain region × 1 crown = 3
    const grid = new Board().place(0, 7, 6, right).place(18, 9, 6, right).snapshot();
    expect(scoreBoard(grid)).toBe(3);
  });

  it("largestRegion returns 0 for an empty board", () => {
    expect(largestRegion(new Board().snapshot())).toBe(0);
  });

  it("largestRegion returns the size of the largest contiguous terrain region", () => {
    // card 0: grain/grain → 2-cell region
    const grid = new Board().place(0, 7, 6, right).snapshot();
    expect(largestRegion(grid)).toBe(2);
  });

  it("totalCrownsGrid returns 0 for an empty board", () => {
    expect(totalCrownsGrid(new Board().snapshot())).toBe(0);
  });

  it("totalCrownsGrid sums all crown values", () => {
    // card 18: grain(1cr)/wood(0cr), card 44: mine(2cr)/grain(0cr) → 3 crowns
    const grid = new Board().place(18, 7, 6, right).place(44, 5, 6, left).snapshot();
    expect(totalCrownsGrid(grid)).toBe(3);
  });

  it("isCastleCenteredGrid returns true for an empty board", () => {
    expect(isCastleCenteredGrid(new Board().snapshot())).toBe(true);
  });

  it("isCastleCenteredGrid returns false for asymmetric placement", () => {
    const grid = new Board().place(0, 7, 6, right).snapshot();
    expect(isCastleCenteredGrid(grid)).toBe(false);
  });
});

describe("Tie-break helpers", () => {
  it("largestPropertySize returns 0 for an empty board", () => {
    expect(new Board().largestPropertySize()).toBe(0);
  });

  it("largestPropertySize returns the size of the single terrain region", () => {
    // card 0: grain/grain at (7,6) right → grain at (7,6)+(8,6) = 2-tile region
    const board = new Board().place(0, 7, 6, right);
    expect(board.largestPropertySize()).toBe(2);
  });

  it("largestPropertySize returns the largest size across multiple regions", () => {
    // card 18: grain(1cr)/wood at (7,6) right → grain at (7,6), wood at (8,6)
    // card 0: grain/grain at (9,6) right → grain at (9,6), grain at (10,6)
    // (9,6) is not adjacent to (7,6): largest region is 2 (the second grain pair)
    const board = new Board().place(18, 7, 6, right).place(0, 9, 6, right);
    expect(board.largestPropertySize()).toBe(2);
  });

  it("totalCrowns returns 0 for an empty board", () => {
    expect(new Board().totalCrowns()).toBe(0);
  });

  it("totalCrowns sums all crown values across all placed tiles", () => {
    // card 18: grain(1cr)/wood(0cr) → +1 crown
    // card 44: mine(2cr)/grain(0cr) → +2 crowns; total = 3
    const board = new Board().place(18, 7, 6, right).place(44, 5, 6, left);
    expect(board.totalCrowns()).toBe(3);
  });
});

describe("Scoring", () => {
  it("an empty kingdom scores zero", () => {
    expect(new Board().score()).toBe(0);
  });

  it("a single terrain region with no crowns scores zero", () => {
    // card 0: grain/grain, 0 crowns → 2-cell grain region × 0 crowns = 0
    const board = new Board().place(0, 7, 6, right);
    expect(board.score()).toBe(0);
  });

  it("a terrain region scores region-size × crown-count", () => {
    // card 0: grain/grain at (7,6)right → grain at (7,6),(8,6), 0 crowns
    // card 18: grain(1cr)/wood at (9,6)right → grain+1crown at (9,6), wood at (10,6)
    // grain region: (7,6)+(8,6)+(9,6) = 3 cells × 1 crown = 3
    const board = new Board().place(0, 7, 6, right).place(18, 9, 6, right);
    expect(board.score()).toBe(3);
  });

  it("two disconnected terrain regions score independently and sum", () => {
    // East: card 18 — grain(1cr) at (7,6), wood at (8,6)    → grain 1×1=1
    // West: card 44 — mine(2cr) at (5,6), grain at (4,6)   → mine  1×2=2
    // Total: 3
    const board = new Board().place(18, 7, 6, right).place(44, 5, 6, left);
    expect(board.score()).toBe(3);
  });

  it("crowns in one terrain region do not affect the score of an adjacent different-terrain region", () => {
    // card 18: grain(1cr)/wood — grain+1crown at (7,6), wood at (8,6)
    // card  3: wood/wood 0cr  — wood at (9,6), wood at (10,6) connected to wood at (8,6)
    // wood region (3 cells, 0 crowns) scores 0; grain region (1 cell, 1 crown) scores 1
    const board = new Board().place(18, 7, 6, right).place(3, 9, 6, right);
    expect(board.score()).toBe(1);
  });
});

// ── Section 4: Middle Kingdom bonus ──────────────────────────────────────────
//
// Board.isCastleCentered() returns true if the bounding box of all placed tiles
// (including castle at grid position (6,6)) is symmetric about the castle.
// Centered means: minX + maxX = 12 AND minY + maxY = 12 (castle is at 6,6 → 6×2=12).

describe("Middle Kingdom bonus — isCastleCentered", () => {
  it("empty board (only castle) is considered centered", () => {
    expect(new Board().isCastleCentered()).toBe(true);
  });

  it("symmetric east+west placement is centered", () => {
    // card 0: grain/grain, placed east (7,6)+(8,6) and west (5,6)+(4,6)
    // minX=4, maxX=8: 4+8=12 ✓  minY=6, maxY=6: 6+6=12 ✓ → centered
    const board = new Board().place(0, 7, 6, right).place(0, 5, 6, left);
    expect(board.isCastleCentered()).toBe(true);
  });

  it("asymmetric placement (only east) is not centered", () => {
    // Only east: (7,6)+(8,6) → minX=6 (castle), maxX=8: 6+8=14 ≠ 12 → not centered
    const board = new Board().place(0, 7, 6, right);
    expect(board.isCastleCentered()).toBe(false);
  });

  it("symmetric in both axes is centered", () => {
    // East (7,6)+(8,6), West (5,6)+(4,6), North (6,5)+(6,4), South (6,7)+(6,8)
    // minX=4, maxX=8: 12 ✓  minY=4, maxY=8: 12 ✓ → centered
    const board = new Board()
      .place(0, 7, 6, right)
      .place(0, 5, 6, left)
      .place(0, 6, 5, up)
      .place(0, 6, 7, down);
    expect(board.isCastleCentered()).toBe(true);
  });
});

// ── Section 5: Bonus scoring in GameSession.endGame() ────────────────────────

describe("Bonus scoring in GameSession.endGame()", () => {
  const makeSessionWithBonuses = (bonuses: { middleKingdom?: boolean; harmony?: boolean }) => {
    const session = new GameSession({ bonuses });
    const me = new Player("me", true);
    const them = new Player("them", false);
    session.addPlayer(me);
    session.addPlayer(them);
    session.startGame([me, them]);
    return { session, me, them };
  };

  it("no bonuses applied when bonus config is empty", () => {
    const { session, me } = makeSessionWithBonuses({});
    me.board.place(0, 7, 6, right).place(0, 5, 6, left); // symmetric, would qualify for MK
    let result: GameEventMap["game:ended"] | undefined;
    session.events.on("game:ended", (data) => {
      result = data;
    });
    session.endGame();
    const meScore = result!.scores.find((s) => s.player.id === "me")!;
    expect(meScore.bonuses.middleKingdom).toBe(0);
    expect(meScore.bonuses.harmony).toBe(0);
    expect(meScore.score).toBe(0);
  });

  it("Middle Kingdom +10 when enabled and castle is centered", () => {
    const { session, me } = makeSessionWithBonuses({ middleKingdom: true });
    me.board.place(0, 7, 6, right).place(0, 5, 6, left); // symmetric
    let result: GameEventMap["game:ended"] | undefined;
    session.events.on("game:ended", (data) => {
      result = data;
    });
    session.endGame();
    const meScore = result!.scores.find((s) => s.player.id === "me")!;
    expect(meScore.bonuses.middleKingdom).toBe(10);
    expect(meScore.score).toBe(10); // 0 base + 10 MK
  });

  it("no Middle Kingdom bonus when castle is not centered", () => {
    const { session, me } = makeSessionWithBonuses({ middleKingdom: true });
    me.board.place(0, 7, 6, right); // only east — asymmetric
    let result: GameEventMap["game:ended"] | undefined;
    session.events.on("game:ended", (data) => {
      result = data;
    });
    session.endGame();
    const meScore = result!.scores.find((s) => s.player.id === "me")!;
    expect(meScore.bonuses.middleKingdom).toBe(0);
  });

  it("Harmony +5 when enabled and player never discarded", () => {
    const { session } = makeSessionWithBonuses({ harmony: true });
    let result: GameEventMap["game:ended"] | undefined;
    session.events.on("game:ended", (data) => {
      result = data;
    });
    session.endGame();
    const meScore = result!.scores.find((s) => s.player.id === "me")!;
    expect(meScore.bonuses.harmony).toBe(5);
    expect(meScore.score).toBe(5); // 0 base + 5 harmony
  });

  it("no Harmony bonus when player discarded during the game", () => {
    const { session, me, them } = makeSessionWithBonuses({ harmony: true });
    // Block all 4 castle-adjacent positions with non-marsh/non-mine terrain
    // so card 46 (marsh/mine) has no eligible neighbour and must be discarded.
    me.board
      .place(0, 7, 6, right) // grain east:  (7,6),(8,6)
      .place(1, 5, 6, left)  // grain west:  (5,6),(4,6)
      .place(6, 6, 7, down)  // water south: (6,7),(6,8)
      .place(9, 6, 5, up);   // grass north: (6,5),(6,4)

    // beginRound with card 46 in the deal; me picks first (pickOrder: [me, them])
    session.beginRound([2, 18, 26, 46]);
    session.handleLocalPick(46); // me picks the marsh/mine card
    session.handleLocalDiscard(); // forced: no valid placement for card 46
    session.handlePick(them.id, 2); // them picks card 2
    session.handlePlacement(them.id, 7, 6, right); // them places; round complete

    let result: GameEventMap["game:ended"] | undefined;
    session.events.on("game:ended", (data) => {
      result = data;
    });
    session.endGame();
    const meScore = result!.scores.find((s) => s.player.id === "me")!;
    const themScore = result!.scores.find((s) => s.player.id === "them")!;
    expect(meScore.bonuses.harmony).toBe(0); // me discarded → no harmony
    expect(themScore.bonuses.harmony).toBe(5); // them never discarded → harmony
  });

  it("both Middle Kingdom and Harmony bonuses stack for +15", () => {
    const { session, me } = makeSessionWithBonuses({ middleKingdom: true, harmony: true });
    me.board.place(0, 7, 6, right).place(0, 5, 6, left); // symmetric, no discards
    let result: GameEventMap["game:ended"] | undefined;
    session.events.on("game:ended", (data) => {
      result = data;
    });
    session.endGame();
    const meScore = result!.scores.find((s) => s.player.id === "me")!;
    expect(meScore.bonuses.middleKingdom).toBe(10);
    expect(meScore.bonuses.harmony).toBe(5);
    expect(meScore.score).toBe(15); // 0 base + 10 MK + 5 harmony
  });
});
