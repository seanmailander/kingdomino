import { chooseOrderFromSeed, getNextFourCards } from "./utils";
import { describe, expect, it } from "vitest";

import { generateDeck } from "./cards";

const SEED_WELL_KNOWN = "1";
const SEED_ALT = "2";
const SEED_ORDER = "test-seed";

describe("Shuffles deck", () => {
  it("produces stable output for fixed seeds (snapshot — run updateSnapshot on intentional RNG changes)", () => {
    // Snapshot the output of getNextFourCards with a fixed seed to catch changes to RNG
    expect(getNextFourCards(SEED_WELL_KNOWN).next).toMatchSnapshot();
  });

  it("Shuffles with a well-known seed", () => {
    // Arrange
    const deck = undefined;

    // Act
    const shuffle = getNextFourCards(SEED_WELL_KNOWN, deck);
    // Assert
    expect(shuffle.next).toStrictEqual([43, 4, 39, 16]);
  });
  it("Replays same shuffle with same seed", () => {
    // Arrange
    const deck = undefined;

    // Act
    const shuffle1 = getNextFourCards(SEED_WELL_KNOWN, deck);
    const shuffle2 = getNextFourCards(SEED_WELL_KNOWN, deck);

    // Assert
    expect(shuffle1.next).toStrictEqual([43, 4, 39, 16]);
    expect(shuffle2.next).toStrictEqual(shuffle1.next);
  });
  it("Different shuffle with different seed", () => {
    // Arrange
    const deck = undefined;

    // Act
    const shuffle1 = getNextFourCards(SEED_WELL_KNOWN, deck);
    const shuffle2 = getNextFourCards(SEED_ALT, deck);

    // Assert
    expect(shuffle1.next).toStrictEqual([43, 4, 39, 16]);
    expect(shuffle2.next).not.toStrictEqual(shuffle1.next);
  });
  it("Remaing deck excludes shuffled tiles", () => {
    // Arrange
    const deck = generateDeck();

    // Act
    const shuffle = getNextFourCards(SEED_WELL_KNOWN, deck);

    const recombinedDeck = [...shuffle.next, ...shuffle.remaining];

    // Assert
    expect(shuffle.remaining).toHaveLength(44);
    expect(recombinedDeck).toIncludeSameMembers(deck);
  });
});

describe("chooseOrderFromSeed", () => {
  it("produces stable output for fixed seeds (snapshot — run updateSnapshot on intentional RNG changes)", () => {
    // Snapshot the output of chooseOrderFromSeed with a fixed seed to catch changes to RNG
    expect(chooseOrderFromSeed(SEED_ORDER, ["alice", "bob"])).toMatchSnapshot();
  });

  it("returns a deterministic order for the same seed regardless of input order", () => {
    const a = chooseOrderFromSeed(SEED_ORDER, ["alice", "bob"]);
    const b = chooseOrderFromSeed(SEED_ORDER, ["bob", "alice"]);
    expect(a).toEqual(b);
    expect(a).toHaveLength(2);
    expect(a).toContain("alice");
    expect(a).toContain("bob");
  });

  it("returns different orders for different seeds", () => {
    const results = new Set<string>();
    // With enough different seeds, we expect at least two different orderings
    for (let i = 0; i < 20; i++) {
      results.add(chooseOrderFromSeed(`seed-${i}`, ["alice", "bob"]).join(","));
    }
    expect(results.size).toBeGreaterThan(1);
  });
});
