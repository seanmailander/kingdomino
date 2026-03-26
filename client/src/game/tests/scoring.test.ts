// Section 3 — Scoring (Logic)
//
// Board.score() uses BFS per terrain region: score = Σ(regionSize × regionCrowns).
// Castle (tile === 0) and empty cells are skipped.
//
// Selected card ids (0-indexed):
//   0  grain/grain       — no crowns
//   3  wood/wood         — no crowns
//  18  grain(1cr)/wood   — crown on tileA  [secondTwelve[6]: getTile(grain, wood, oneCrown)]
//  44  mine(2cr)/grain   — crown on tileA  [fourthTwelve[8]: getTile(mine, grain, twoCrown)]
import { describe, expect, it } from "vitest";
import { Board } from "../state/Board";
import { right, left } from "../gamelogic/cards";

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
