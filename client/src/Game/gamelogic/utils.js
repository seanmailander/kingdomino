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

// - 128 cards, each is unique (some repeats?)
// - canonical identification (sort)
// - both A and B calculate sorted deck using shared seed

const deck = [1, 2, 3, 4, 5, 6, 7, 8, 9];
export const getNextFourCards = (seed, remainingDeck = deck) => {
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
