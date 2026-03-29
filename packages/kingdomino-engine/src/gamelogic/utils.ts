import { ChaChaRng } from "chacha-rng";

import { generateDeck } from "./cards";

// Derive a 32-byte ChaCha seed from an arbitrary string deterministically.
function seedStringToBytes(seed: string): Uint8Array {
  const encoded = new TextEncoder().encode(seed);
  const result = new Uint8Array(32);
  for (let i = 0; i < 32; i++) {
    result[i] = encoded[i % encoded.length] ^ (i & 0xff);
  }
  return result;
}

// Make a predictable pseudorandom number generator.
// https://stackoverflow.com/a/12646864
const seededShuffle = (seed: string) => {
  const rng = ChaChaRng.fromSeed(seedStringToBytes(seed));

  return <T>(array: T[]): T[] => {
    for (let i = array.length - 1; i > 0; i--) {
      const j = Number(rng.next_u64() % BigInt(i + 1));
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

// Commitment protocol utilities
export const commit = async (secret: string): Promise<string> => {
  const data = new TextEncoder().encode(secret);
  const hash = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(hash))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
};

export const verify = async (secret: string, commitment: string): Promise<boolean> =>
  (await commit(secret)) === commitment;

export const combine = (a: string, b: string): string => {
  const aNum = BigInt("0x" + a);
  const bNum = BigInt("0x" + b);
  return (aNum ^ bNum).toString(16).padStart(64, "0");
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

export const chooseOrderFromSeed = (seed: string, playerIds: readonly string[]): string[] => {
  // Sort for determinism (both peers start from the same canonical order)
  const sorted = [...playerIds].sort();
  return seededShuffle(seed)(sorted);
};
