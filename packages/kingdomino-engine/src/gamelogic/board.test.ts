import { findPlacementWithin5x5, getEligiblePositions, getValidDirections, getEmptyBoard } from "./board";
import { describe, expect, it } from "vitest";
import type { BoardGrid } from "./board";
import { getCard, castle, up, down, left, right } from "./cards";

type BoardPlacement = { card: number; x: number; y: number; direction: string };

const xDir: Record<string, number> = { [up]: 0, [right]: 1, [down]: 0, [left]: -1 };
const yDir: Record<string, number> = { [up]: -1, [right]: 0, [down]: 1, [left]: 0 };

function buildSnapshot(placements: BoardPlacement[]): BoardGrid {
  const board = getEmptyBoard() as { tile?: number; value?: number }[][];
  board[6][6] = { tile: castle };
  for (const { card, x, y, direction } of placements) {
    const xB = x + xDir[direction];
    const yB = y + yDir[direction];
    if (xB < 0 || xB > 12 || yB < 0 || yB > 12) continue;
    const { tiles: [{ tile: tileA, value: valueA }, { tile: tileB, value: valueB }] } = getCard(card);
    board[y][x] = { tile: tileA, value: valueA };
    board[yB][xB] = { tile: tileB, value: valueB };
  }
  return board as BoardGrid;
}

describe("Checks moves", () => {
  it("Allows any move off castle", () => {
    // Arrange
    const placedCards: BoardPlacement[] = [];
    const card = 1;
    const x = 6;
    const y = 7;
    const board = buildSnapshot(placedCards);

    // Act
    const eligiblePositions = getEligiblePositions(board, card);
    const validDirections = getValidDirections(board, card, x, y);

    // Assert
    expect(eligiblePositions).toStrictEqual([
      { x: 7, y: 6, direction: right },
      { x: 5, y: 6, direction: left },
      { x: 6, y: 7, direction: down },
      { x: 6, y: 5, direction: up },
    ]);
    expect(validDirections).toIncludeSameMembers([left, right, down]);
  });

  describe("findPlacementWithin5x5", () => {
    it("picks a deterministic first valid anchor and direction on an empty board", () => {
      // Arrange
      const board = buildSnapshot([]);

      // Act
      const placement = findPlacementWithin5x5(board, 1);

      // Assert
      expect(placement).toStrictEqual({ x: 6, y: 5, direction: up });
    });

    it("returns null when the kingdom is already fully packed at 5x5", () => {
      // Arrange
      const placements: BoardPlacement[] = [];
      for (let y = 4; y <= 8; y++) {
        placements.push({ card: 1, x: 4, y, direction: right });
        placements.push({ card: 1, x: 6, y, direction: right });
        placements.push({ card: 1, x: 8, y, direction: left });
      }
      const board = buildSnapshot(placements);

      // Act
      const placement = findPlacementWithin5x5(board, 1);

      // Assert
      expect(placement).toBeNull();
    });
  });
});
