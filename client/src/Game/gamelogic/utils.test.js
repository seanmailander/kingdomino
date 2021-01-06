import {
  generateDeck,
  getNextFourCards,
  water,
  wood,
  marsh,
  mine,
  grain,
  grass,
} from "./utils";

function bitCount(n) {
  n = n - ((n >> 1) & 0x55555555);
  n = (n & 0x33333333) + ((n >> 2) & 0x33333333);
  return (((n + (n >> 4)) & 0xf0f0f0f) * 0x1010101) >> 24;
}

describe("Builds deck", () => {
  it("Creates a deck with 48 cards", () => {
    // Arrange

    // Act
    const deck = generateDeck();

    // Assert
    expect(deck.length).toBe(48);
  });
  it("First deck entry is the right card", () => {
    // Arrange

    // Act
    const deck = generateDeck();

    // Assert
    expect(deck[0]).toStrictEqual({
      type: 8,
      tiles: [
        { tile: 8, value: 0 },
        { tile: 8, value: 0 },
      ],
    });
  });
  it("All deck entries are the right format", () => {
    // Arrange

    // Act
    const deck = generateDeck();

    // Assert
    deck.forEach((c) => {
      expect(c.type).toBeNumber();
      expect(c.tiles).toBeArray();
      expect(c.tiles).toHaveLength(2);

      c.tiles.forEach((t) => {
        expect(t.tile).toBeNumber();
        expect(t.value).toBeNumber();
      });
    });
  });
  it("Total counts are correct", () => {
    // Arrange
    const countTiles = (deck, typeToMatch) =>
      deck.reduce((prev, { type }) => {
        const numBits = bitCount(type ^ typeToMatch);
        if (numBits === 0) {
          return prev + 2;
        }
        if (numBits === 1) {
          return prev + 1;
        }
        return prev;
      }, 0);

    const countCrowns = (deck, typeToMatch) =>
      deck.reduce(
        (prev, { tiles }) =>
          prev + (tiles.find((t) => t.tile === typeToMatch)?.value || 0),
        0
      );

    // Act
    const deck = generateDeck();

    // Assert
    expect(countTiles(deck, grain)).toEqual(26);
    expect(countCrowns(deck, grain)).toEqual(5);

    expect(countTiles(deck, water)).toEqual(18);
    expect(countCrowns(deck, water)).toEqual(6);

    expect(countTiles(deck, wood)).toEqual(22);
    expect(countCrowns(deck, wood)).toEqual(6);

    expect(countTiles(deck, grass)).toEqual(14);
    expect(countCrowns(deck, grass)).toEqual(6);

    expect(countTiles(deck, marsh)).toEqual(10);
    expect(countCrowns(deck, marsh)).toEqual(6);

    expect(countTiles(deck, mine)).toEqual(6);
    expect(countCrowns(deck, mine)).toEqual(10);
  });
});

describe("Shuffles deck", () => {
  it("Shuffles with a well-known seed", () => {
    // Arrange
    const seed = 1;
    const deck = undefined;

    // Act
    const shuffle = getNextFourCards(seed, deck);
    const nextFourTiles = shuffle.next.map((t) => t.type);
    // Assert
    expect(nextFourTiles).toStrictEqual([9, 9, 10, 24]);
  });
  it("Replays same shuffle with same seed", () => {
    // Arrange
    const seed = 1;
    const deck = undefined;

    // Act
    const shuffle1 = getNextFourCards(seed, deck);
    const shuffle2 = getNextFourCards(seed, deck);

    const nextFourTiles1 = shuffle1.next.map((t) => t.type);
    const nextFourTiles2 = shuffle2.next.map((t) => t.type);
    // Assert
    expect(nextFourTiles1).toStrictEqual([9, 9, 10, 24]);
    expect(nextFourTiles2).toStrictEqual(nextFourTiles1);
  });
  it("Different shuffle with different seed", () => {
    // Arrange
    const seed1 = 1;
    const seed2 = 2;
    const deck = undefined;

    // Act
    const shuffle1 = getNextFourCards(seed1, deck);
    const shuffle2 = getNextFourCards(seed2, deck);

    const nextFourTiles1 = shuffle1.next.map((t) => t.type);
    const nextFourTiles2 = shuffle2.next.map((t) => t.type);
    // Assert
    expect(nextFourTiles1).toStrictEqual([9, 9, 10, 24]);
    expect(nextFourTiles2).toStrictEqual([10, 4, 40, 12]);
    expect(nextFourTiles2).not.toStrictEqual(nextFourTiles1);
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
