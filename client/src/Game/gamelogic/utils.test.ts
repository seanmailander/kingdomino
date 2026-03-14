import { getNextFourCards } from "./utils";

import { generateDeck } from "./cards";

describe("Shuffles deck", () => {
  it("Shuffles with a well-known seed", () => {
    // Arrange
    const seed = 1;
    const deck = undefined;

    // Act
    const shuffle = getNextFourCards(seed, deck);
    // Assert
    expect(shuffle.next).toStrictEqual([12, 26, 14, 15]);
  });
  it("Replays same shuffle with same seed", () => {
    // Arrange
    const seed = 1;
    const deck = undefined;

    // Act
    const shuffle1 = getNextFourCards(seed, deck);
    const shuffle2 = getNextFourCards(seed, deck);

    // Assert
    expect(shuffle1.next).toStrictEqual([12, 26, 14, 15]);
    expect(shuffle2.next).toStrictEqual(shuffle1.next);
  });
  it("Different shuffle with different seed", () => {
    // Arrange
    const seed1 = 1;
    const seed2 = 2;
    const deck = undefined;

    // Act
    const shuffle1 = getNextFourCards(seed1, deck);
    const shuffle2 = getNextFourCards(seed2, deck);

    // Assert
    expect(shuffle1.next).toStrictEqual([12, 26, 14, 15]);
    expect(shuffle2.next).toStrictEqual([20, 6, 22, 30]);
    expect(shuffle2.next).not.toStrictEqual(shuffle1.next);
  });
  it("Remaing deck excludes shuffled tiles", () => {
    // Arrange
    const seed = 1;
    const deck = generateDeck();

    // Act
    const shuffle = getNextFourCards(seed, deck);

    const recombinedDeck = [...shuffle.next, ...shuffle.remaining];

    // Assert
    expect(shuffle.remaining).toHaveLength(44);
    expect(recombinedDeck).toIncludeSameMembers(deck);
  });
});
