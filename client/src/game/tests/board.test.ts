import { describe, expect, it } from "vitest";

import { Board, type BoardPlacement } from "../state/Board";
import {
  castle,
  down,
  grain,
  marsh,
  noCrown,
  oneCrown,
  right,
  twoCrown,
  up,
  left,
  water,
  wood,
} from "../gamelogic/cards";

const placedCardsToBoard = (placements: BoardPlacement[] = []) =>
  new Board(placements).placedCardsToBoard();

describe("Builds deck", () => {
  it("Creates a deck with 48 cards and castle in the center", () => {
    // Arrange
    const placedCards: BoardPlacement[] = [];

    // Act
    const board = placedCardsToBoard(placedCards);

    // Assert
    expect(board.length).toBe(13);
    expect(board[0].length).toBe(13);

    expect(board[6][6]).toStrictEqual({
      tile: castle,
    });
  });
  it("Places cards in any direction", () => {
    // Arrange
    const placedCards = [
      {
        card: 19, // grain-water-onecrown
        x: 3,
        y: 5,
        direction: right,
      },
      {
        card: 32, // water-wood-onecrown
        x: 5,
        y: 8,
        direction: down,
      },
      {
        card: 34, // water-wood-onecrown
        x: 11,
        y: 11,
        direction: left,
      },
      {
        card: 42, // grain-marsh-null-twocrown
        x: 4,
        y: 11,
        direction: up,
      },
    ];

    // Act
    const board = placedCardsToBoard(placedCards);

    // Assert
    // grain-water-onecrown - right
    expect(board[5][3]).toStrictEqual({
      tile: grain,
      value: oneCrown,
    });
    expect(board[5][4]).toStrictEqual({
      tile: water,
      value: noCrown,
    });

    // water-wood-onecrown - down
    expect(board[8][5]).toStrictEqual({
      tile: water,
      value: oneCrown,
    });
    expect(board[9][5]).toStrictEqual({
      tile: wood,
      value: noCrown,
    });

    // water-wood-onecrown - left
    expect(board[11][11]).toStrictEqual({
      tile: water,
      value: oneCrown,
    });
    expect(board[11][10]).toStrictEqual({
      tile: wood,
      value: noCrown,
    });

    // grain-marsh-null-twocrown - up
    expect(board[11][4]).toStrictEqual({
      tile: grain,
      value: noCrown,
    });
    expect(board[10][4]).toStrictEqual({
      tile: marsh,
      value: twoCrown,
    });
  });
});
