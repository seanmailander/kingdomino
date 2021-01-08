import { placedCardsToBoard } from "./board";
import {
  castle,
  grain,
  grass,
  marsh,
  noCrown,
  oneCrown,
  right,
  twoCrown,
  up,
  water,
  wood,
} from "./cards";

describe("Builds deck", () => {
  it("Creates a deck with 48 cards and castle in the center", () => {
    // Arrange
    const placedCards = [];

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
        direction: 1, // up
      },
      {
        card: 32, // water-wood-onecrown
        x: 5,
        y: 8,
        direction: 2, // right
      },
      {
        card: 34, // water-wood-onecrown
        x: 11,
        y: 11,
        direction: 3, // down
      },
      {
        card: 42, // grain-marsh-null-twocrown
        x: 4,
        y: 11,
        direction: 4, // left
      },
    ];

    // Act
    const board = placedCardsToBoard(placedCards);

    // Assert
    // grain-water-onecrown - up
    expect(board[3][5]).toStrictEqual({
      tile: grain,
      value: oneCrown,
    });
    expect(board[2][5]).toStrictEqual({
      tile: water,
      value: noCrown,
    });

    // water-wood-onecrown - right
    expect(board[5][8]).toStrictEqual({
      tile: water,
      value: oneCrown,
    });
    expect(board[5][9]).toStrictEqual({
      tile: wood,
      value: noCrown,
    });

    // water-wood-onecrown - down
    expect(board[11][11]).toStrictEqual({
      tile: water,
      value: oneCrown,
    });
    expect(board[12][11]).toStrictEqual({
      tile: wood,
      value: noCrown,
    });

    // grain-marsh-null-twocrown - left
    expect(board[4][11]).toStrictEqual({
      tile: grain,
      value: noCrown,
    });
    expect(board[4][10]).toStrictEqual({
      tile: marsh,
      value: twoCrown,
    });
  });
});
