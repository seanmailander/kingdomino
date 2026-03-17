import { describe, expect, it } from "vitest";

import { Board } from "../state/Board";
import { left, right, up } from "./cards";
import { findPlacementWithin5x5 } from "./placement";

describe("findPlacementWithin5x5", () => {
  it("picks a deterministic first valid anchor and direction on an empty board", () => {
    // Arrange
    const board = new Board();

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
    const board = new Board(placements);

    // Act
    const placement = findPlacementWithin5x5(board, 1);

    // Assert
    expect(placement).toBeNull();
  });
});