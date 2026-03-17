type CardValue = number;
type CardInfo = {
  type: number;
  tiles: [{ tile: number; value: CardValue }, { tile: number; value: CardValue }];
};

// - 48 cards, each is unique (some repeats?)
// - canonical identification (sort)
// - both A and B calculate sorted deck using shared seed
export const blank = -1 as const;
export const castle = 0 as const;
export const wood = 1 as const;
export const grass = 2 as const;
export const water = 4 as const;
export const grain = 8 as const;
export const marsh = 16 as const;
export const mine = 32 as const;

export const validTiles = [blank, castle, wood, grass, water, grain, marsh, mine] as const;

export const noCrown = 0;
export const oneCrown = 1;
export const twoCrown = 2;
export const threeCrown = 3;

export const up = "up" as const;
export const right = "right" as const;
export const down = "down" as const;
export const left = "left" as const;

const getTile = (
  tileA: number,
  tileB: number,
  crownsA: CardValue = noCrown,
  crownsB: CardValue = noCrown,
): CardInfo => ({
  type: tileA ^ tileB || tileA, // Either the XOR, or just the value itself
  tiles: [
    { tile: tileA, value: crownsA },
    { tile: tileB, value: crownsB },
  ],
});

export const generateCardMap = (): CardInfo[] => {
  // 48 cards
  const firstTwelve = [
    getTile(grain, grain), // Two double-grain
    getTile(grain, grain),
    getTile(wood, wood), // Four double-wood
    getTile(wood, wood),
    getTile(wood, wood),
    getTile(wood, wood),
    getTile(water, water), // Three double-water
    getTile(water, water),
    getTile(water, water),
    getTile(grass, grass), // Two double-grass
    getTile(grass, grass),
    getTile(marsh, marsh), // One double-marsh
  ];

  const secondTwelve = [
    getTile(grain, wood),
    getTile(grain, water),
    getTile(grain, grass),
    getTile(grain, marsh),
    getTile(wood, water),
    getTile(wood, grass),
    getTile(grain, wood, oneCrown),
    getTile(grain, water, oneCrown),
    getTile(grain, grass, oneCrown),
    getTile(grain, marsh, oneCrown),
    getTile(grain, mine, oneCrown),
    getTile(wood, grain, oneCrown),
  ];

  const thirdTwelve = [
    getTile(wood, grain, oneCrown), // 25
    getTile(wood, grain, oneCrown), // 26
    getTile(wood, grain, oneCrown), // 27
    getTile(wood, water, oneCrown), // 28
    getTile(wood, grass, oneCrown), // 29
    getTile(water, grain, oneCrown), // 30
    getTile(water, grain, oneCrown), // 31
    getTile(water, wood, oneCrown), // 32
    getTile(water, wood, oneCrown), // 33
    getTile(water, wood, oneCrown), // 34
    getTile(water, wood, oneCrown), // 35
    getTile(grain, grass, undefined, oneCrown), // 36
  ];

  const fourthTwelve = [
    getTile(water, grass, undefined, oneCrown), // 37
    getTile(grain, marsh, undefined, oneCrown), // 38
    getTile(grass, marsh, undefined, oneCrown), // 39
    getTile(mine, grain, oneCrown), // 40
    getTile(grain, grass, undefined, twoCrown), // 41
    getTile(water, grass, undefined, twoCrown), // 42
    getTile(grain, marsh, undefined, twoCrown), // 43
    getTile(grass, marsh, undefined, twoCrown), // 44
    getTile(mine, grain, twoCrown), // 45
    getTile(marsh, mine, undefined, twoCrown), // 46
    getTile(marsh, mine, undefined, twoCrown), // 47
    getTile(grain, mine, undefined, threeCrown), // 48
  ];
  return [...firstTwelve, ...secondTwelve, ...thirdTwelve, ...fourthTwelve];
};

export const generateDeck = () => [...Array(48).keys()] as const;

const cardMap = generateCardMap();

const blankCard: CardInfo = {
  type: blank,
  tiles: [
    { tile: blank, value: noCrown },
    { tile: blank, value: noCrown },
  ],
};

export const getCard = (cardId: number): CardInfo & { id: number } => ({
  id: cardId,
  ...(cardMap[cardId] ?? blankCard),
});
