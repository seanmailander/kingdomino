import seedrandom from "seedrandom";

import { generateDeck } from "./cards";

type PeerIdentifiers = { me: string; them: string };

// Make a predictable pseudorandom number generator.
// https://stackoverflow.com/a/12646864
const seededShuffle = (seed: string | number) => {
  const seededRandom = seedrandom(String(seed));

  return <T>(array: T[]): T[] => {
    for (let i = array.length - 1; i > 0; i--) {
      const j = Math.floor(seededRandom() * (i + 1));
      [array[i], array[j]] = [array[j], array[i]];
    }
    return array;
  };
};

export const hashIt = async (input: string | number): Promise<string> => {
  const encoder = new TextEncoder();
  const data = encoder.encode(String(input));
  const hash = await crypto.subtle.digest("SHA-1", data);
  const hashString = btoa(String.fromCharCode(...new Uint8Array(hash)));
  return hashString;
};

export const commit = async (): Promise<{ secret: number; committment: string }> => {
  const randomNumber = seedrandom().int32();
  const hashString = await hashIt(randomNumber);

  return {
    secret: randomNumber,
    committment: hashString,
  };
};

export const verify = async (secret: string | number, committment: string): Promise<boolean> => {
  const hashString = await hashIt(secret);
  return committment === hashString;
};

export const combine = async (a: number, b: number): Promise<string> => {
  const combinedRandom = a ^ b;
  return hashIt(combinedRandom);
};

export const getNextFourCards = (
  seed: string,
  remainingDeck: readonly number[] = generateDeck(),
): { next: number[]; remaining: number[] } => {
  const shuffledDeck = seededShuffle(seed)(remainingDeck.slice(0));
  const nextFour = shuffledDeck.slice(0, 4);
  const nextRemaining = shuffledDeck.slice(4);
  return {
    next: nextFour,
    remaining: nextRemaining,
  };
};

export const chooseOrderFromSeed = (seed: string, peerIdentifiers: PeerIdentifiers) => {
  const { me, them } = peerIdentifiers;

  const seededRandom = seedrandom(seed);
  const invertOrder = seededRandom() < 0.5;
  const [first, second] = me < them ? [me, them] : [them, me];

  return invertOrder ? [second, first] as const : [first, second] as const;
};
