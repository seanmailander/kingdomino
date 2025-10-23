import {
  generateCardMap,
  getCard,
  water,
  wood,
  marsh,
  mine,
  grain,
  grass,
  noCrown,
  oneCrown,
  twoCrown,
  threeCrown,
} from "./cards";

function bitCount(n) {
  n = n - ((n >> 1) & 0x55555555);
  n = (n & 0x33333333) + ((n >> 2) & 0x33333333);
  return (((n + (n >> 4)) & 0xf0f0f0f) * 0x1010101) >> 24;
}

describe("Builds deck", () => {
  it("Creates a deck with 48 cards", () => {
    // Arrange

    // Act
    const cardMap = generateCardMap();

    // Assert
    expect(cardMap.length).toBe(48);
  });
  it("First deck entry is the right card", () => {
    // Arrange

    // Act
    const cardMap = generateCardMap();

    // Assert
    expect(cardMap[0]).toStrictEqual({
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
    const cardMap = generateCardMap();

    // Assert
    cardMap.forEach((c) => {
      expect(c.type).toBeNumber();
      expect(c.tiles).toBeArray();
      expect(c.tiles).toHaveLength(2);

      c.tiles.forEach((t) => {
        expect(t.tile).toBeNumber();
        expect(t.value).toBeNumber();
      });
    });
  });
  it("Gets a card from the deck", () => {
    // Arrange

    // Act
    const card = getCard(45);

    // Assert
    expect(card.id).toBe(45);
    expect(card.type).toBe(48);
    expect(card.tiles).toEqual([
      {
        tile: marsh,
        value: noCrown,
      },
      {
        tile: mine,
        value: twoCrown,
      },
    ]);
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
        0,
      );

    // Act
    const cardMap = generateCardMap();

    // Assert
    expect(countTiles(cardMap, grain)).toEqual(26);
    expect(countCrowns(cardMap, grain)).toEqual(5);

    expect(countTiles(cardMap, water)).toEqual(18);
    expect(countCrowns(cardMap, water)).toEqual(6);

    expect(countTiles(cardMap, wood)).toEqual(22);
    expect(countCrowns(cardMap, wood)).toEqual(6);

    expect(countTiles(cardMap, grass)).toEqual(14);
    expect(countCrowns(cardMap, grass)).toEqual(6);

    expect(countTiles(cardMap, marsh)).toEqual(10);
    expect(countCrowns(cardMap, marsh)).toEqual(6);

    expect(countTiles(cardMap, mine)).toEqual(6);
    expect(countCrowns(cardMap, mine)).toEqual(10);
  });
});
