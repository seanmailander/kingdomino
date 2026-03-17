import { findPlacementWithin5x5, getEligiblePositions, getValidDirections } from "./board";
import { describe, expect, it } from "vitest";
import { Board } from "../state/Board";
import {
  down,
  right,
  up,
  left,
} from "./cards";

describe("Checks moves", () => {
  it("Allows any move off castle", () => {
    // Arrange
    const placedCards = [];
    const card = 1;
    const x = 6;
    const y = 7;
    const board = (new Board(placedCards)).snapshot();

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
    const board = (new Board([])).snapshot();
  
      // Act
      const placement = findPlacementWithin5x5(board, 1);
  
      // Assert
      expect(placement).toStrictEqual({ x: 6, y: 5, direction: up });
    });
  
    it("returns null when the kingdom is already fully packed at 5x5", () => {
      // Arrange
      const placements = [];
      for (let y = 4; y <= 8; y++) {
        placements.push({ card: 1, x: 4, y, direction: right });
        placements.push({ card: 1, x: 6, y, direction: right });
        placements.push({ card: 1, x: 8, y, direction: left });
      }
    const board = (new Board(placements)).snapshot();
  
      // Act
      const placement = findPlacementWithin5x5(board, 1);
  
      // Assert
      expect(placement).toBeNull();
    });
  });
});
