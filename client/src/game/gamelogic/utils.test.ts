import { getNextFourCards } from "./utils";
import { describe, expect, it } from "vitest";

import { generateDeck } from "./cards";

describe("Shuffles deck", () => {
  it("Shuffles with a well-known seed", () => {
    // Arrange
    const seed = "1";
    const deck = undefined;

    // Act
    const shuffle = getNextFourCards(seed, deck);
    // Assert
    expect(shuffle.next).toStrictEqual([35, 32, 14, 28]);
  });
  it("Replays same shuffle with same seed", () => {
    // Arrange
    const seed = "1";
    const deck = undefined;

    // Act
    const shuffle1 = getNextFourCards(seed, deck);
    const shuffle2 = getNextFourCards(seed, deck);

    // Assert
    expect(shuffle1.next).toStrictEqual([35, 32, 14, 28]);
    expect(shuffle2.next).toStrictEqual(shuffle1.next);
  });
  it("Different shuffle with different seed", () => {
    // Arrange
    const seed1 = "1";
    const seed2 = "2";
    const deck = undefined;

    // Act
    const shuffle1 = getNextFourCards(seed1, deck);
    const shuffle2 = getNextFourCards(seed2, deck);

    // Assert
    expect(shuffle1.next).toStrictEqual([35, 32, 14, 28]);
    expect(shuffle2.next).toStrictEqual([33, 21, 22, 32]);
    expect(shuffle2.next).not.toStrictEqual(shuffle1.next);
  });
  it("Remaing deck excludes shuffled tiles", () => {
    // Arrange
    const seed = "1";
    const deck = generateDeck();

    // Act
    const shuffle = getNextFourCards(seed, deck);

    const recombinedDeck = [...shuffle.next, ...shuffle.remaining];

    // Assert
    expect(shuffle.remaining).toHaveLength(44);
    expect(recombinedDeck).toIncludeSameMembers(deck);
  });
});
