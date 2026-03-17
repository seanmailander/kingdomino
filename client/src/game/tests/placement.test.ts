// Section 2 — Card Placement (Logic)
//
// Board coordinate system: castle fixed at (6,6) on a 13×13 grid.
// Placing a card at (x, y) with direction puts tileA at (x,y) and tileB one
// step in that direction.  right→(x+1,y)  left→(x-1,y)  down→(x,y+1)  up→(x,y-1)
//
// Selected card ids (0-indexed, matching cardMap order):
//   0  grain/grain  — no crowns
//   2  wood/wood    — no crowns
//   3  wood/wood    — no crowns
//   6  water/water  — no crowns
import { describe, expect, it } from "vitest";
import { getEligiblePositions, getValidDirections } from "../gamelogic/board";
import { right, left } from "../gamelogic/cards";
import { Board } from "../state/Board";

const placedCardsToBoard = (placements = []) => new Board(placements).placedCardsToBoard();

describe("Card placement", () => {
  it("a fresh kingdom accepts a card adjacent to the castle in all four directions", () => {
    const board = placedCardsToBoard([]);
    const positions = getEligiblePositions(board, 1); // grain/grain
    const coords = positions.map(({ x, y }) => `${x},${y}`);
    expect(coords).toContain("7,6"); // east
    expect(coords).toContain("5,6"); // west
    expect(coords).toContain("6,7"); // south
    expect(coords).toContain("6,5"); // north
  });

  it("a card touching a matching terrain is eligible at that position", () => {
    // wood/wood placed east of castle → wood tiles at (7,6) and (8,6)
    const board = placedCardsToBoard([{ card: 2, x: 7, y: 6, direction: right }]);
    // another wood card is eligible at (9,6): adjacent to wood at (8,6)
    const positions = getEligiblePositions(board, 3);
    expect(positions.map(({ x, y }) => `${x},${y}`)).toContain("9,6");
  });

  it("a card touching only non-matching terrain is not eligible at that cell", () => {
    // water/water placed east of castle → water at (7,6) and (8,6)
    const board = placedCardsToBoard([{ card: 6, x: 7, y: 6, direction: right }]);
    // wood card: water & wood = 0, so (9,6) — neighbour of water only — is not eligible
    const positions = getEligiblePositions(board, 2);
    expect(positions.map(({ x, y }) => `${x},${y}`)).not.toContain("9,6");
  });

  it("a card adjacent to the castle is always eligible regardless of terrain", () => {
    // grain already placed east; water card is still eligible west (adjacent to castle)
    const board = placedCardsToBoard([{ card: 0, x: 7, y: 6, direction: right }]);
    const positions = getEligiblePositions(board, 6); // water/water
    expect(positions.map(({ x, y }) => `${x},${y}`)).toContain("5,6");
  });

  it("eligible positions do not include already-occupied cells", () => {
    const board = placedCardsToBoard([{ card: 2, x: 7, y: 6, direction: right }]);
    const positions = getEligiblePositions(board, 3);
    // (7,6) and (8,6) are occupied — neither should appear
    expect(positions.every(({ x, y }) => !(x === 7 && y === 6))).toBe(true);
    expect(positions.every(({ x, y }) => !(x === 8 && y === 6))).toBe(true);
  });

  it("validDirections excludes an orientation where the second tile would land on an occupied cell", () => {
    // (7,6) is east of the castle; placing left would put tileB on the castle at (6,6)
    const board = placedCardsToBoard([]);
    const dirs = getValidDirections(board, 1, 7, 6);
    expect(dirs).not.toContain(left);
  });

  it("validDirections excludes directions that would place the second tile out of bounds", () => {
    // At x=0, going left would try to reach x=-1 which is off the grid
    const board = placedCardsToBoard([]);
    const dirs = getValidDirections(board, 1, 0, 6);
    expect(dirs).not.toContain(left);
  });

  it.todo("a placement that would push the kingdom beyond 5×5 is invalid");
});
