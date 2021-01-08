import { placedCardsToBoard } from "./board";

describe.only("Builds deck", () => {
  it("Creates a deck with 48 cards", () => {
    // Arrange
    const placedCards = [
      {
        card: 3,
        x: 3,
        y: 5,
        direction: 1,
      },
      {
        card: 32,
        x: 3,
        y: 5,
        direction: 1,
      },
    ];

    // Act
    const board = placedCardsToBoard(placedCards);
    console.debug(board);
    // Assert
    expect(board.length).toBe(13);
    expect(board[0].length).toBe(13);
  });
});
