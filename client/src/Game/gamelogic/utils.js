import seedrandom from "seedrandom";

// Make a predictable pseudorandom number generator.
// https://stackoverflow.com/a/12646864
const seededShuffle = (seed) => {
  const seededRandom = seedrandom(seed);

  return (array) => {
    for (let i = array.length - 1; i > 0; i--) {
      const j = Math.floor(seededRandom() * (i + 1));
      [array[i], array[j]] = [array[j], array[i]];
    }
    return array;
  };
};

export const hashIt = async (input) => {
  const encoder = new TextEncoder();
  const data = encoder.encode(input);
  const hash = await crypto.subtle.digest("SHA-1", data);
  const hashString = btoa(String.fromCharCode(...new Uint8Array(hash)));
  return hashString;
};

export const commit = async () => {
  const randomNumber = seedrandom().int32();
  const hashString = await hashIt(randomNumber);

  return {
    secret: randomNumber,
    committment: hashString,
  };
};

export const verify = async (secret, committment) => {
  const hashString = await hashIt(secret);
  return committment === hashString;
};

export const combine = async (a, b) => {
  const combinedRandom = a ^ b;
  return hashIt(combinedRandom);
};

// - 48 cards, each is unique (some repeats?)
// - canonical identification (sort)
// - both A and B calculate sorted deck using shared seed
export const castle = 0;
export const wood = 2 ** 0;
export const grass = 2 ** 1;
export const water = 2 ** 2;
export const grain = 2 ** 3;
export const marsh = 2 ** 4;
export const mine = 2 ** 5;

export const noCrown = 0;
export const oneCrown = 1;
export const twoCrown = 2;
export const threeCrown = 3;

const getTile = (tileA, tileB, crownsA = noCrown, crownsB = noCrown) => ({
  type: tileA ^ tileB || tileA, // Either the XOR, or just the value itself
  tiles: [
    { tile: tileA, value: crownsA },
    { tile: tileB, value: crownsB },
  ],
});

export const generateCardMap = () => {
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
    getTile(wood, grain, oneCrown),
    getTile(wood, grain, oneCrown),
    getTile(wood, grain, oneCrown),
    getTile(wood, water, oneCrown),
    getTile(wood, grass, oneCrown),
    getTile(water, grain, oneCrown),
    getTile(water, grain, oneCrown),
    getTile(water, wood, oneCrown),
    getTile(water, wood, oneCrown),
    getTile(water, wood, oneCrown),
    getTile(water, wood, oneCrown),
    getTile(grain, grass, undefined, oneCrown),
  ];

  const fourthTwelve = [
    getTile(grass, marsh, undefined, oneCrown),
    getTile(mine, grain, oneCrown),
    getTile(grain, marsh, undefined, twoCrown),
    getTile(water, grass, undefined, oneCrown),
    getTile(grain, marsh, undefined, oneCrown),
    getTile(grain, grass, undefined, twoCrown),
    getTile(water, grass, undefined, twoCrown),
    getTile(grass, marsh, undefined, twoCrown),
    getTile(mine, grain, twoCrown),
    getTile(marsh, mine, undefined, twoCrown),
    getTile(marsh, mine, undefined, twoCrown),
    getTile(grain, mine, undefined, threeCrown),
  ];
  return [...firstTwelve, ...secondTwelve, ...thirdTwelve, ...fourthTwelve];
};

export const generateDeck = () => [...Array(48).keys()];

const cardMap = generateCardMap();

export const getCard = (cardId) => ({
  id: cardId,
  ...cardMap[cardId],
});

export const getNextFourCards = (seed, remainingDeck = generateDeck()) => {
  const shuffledDeck = seededShuffle(seed)(remainingDeck.slice(0));
  const nextFour = shuffledDeck.slice(0, 4);
  const nextRemaining = shuffledDeck.slice(4);
  return {
    next: nextFour,
    remaining: nextRemaining,
  };
};

export const chooseOrderFromSeed = (seed, peerIdentifiers) => {
  const { me, them } = peerIdentifiers;

  const seededRandom = seedrandom(seed);
  const invertOrder = seededRandom() < 0.5;

  const straightSort = (a, b) => (a < b ? -1 : 1);
  const invertedSort = (a, b) => (a > b ? -1 : 1);

  return [me, them].sort(invertOrder ? invertedSort : straightSort);
};
