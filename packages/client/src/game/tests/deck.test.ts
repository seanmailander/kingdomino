// Section 1 — Deck
import { describe, expect, it } from "vitest";
import { generateCardMap, generateDeck } from "kingdomino-engine";
import { getNextFourCards } from "kingdomino-engine";

const SEED_SAME = "42";
const SEED_A = "1";
const SEED_B = "2";

describe("Deck", () => {
  it("produces stable output for fixed seeds (snapshot — run updateSnapshot on intentional RNG changes)", () => {
    // Snapshot the output of getNextFourCards with a fixed seed to catch changes to RNG
    expect(getNextFourCards(SEED_SAME).next).toMatchSnapshot();
    expect(getNextFourCards(SEED_A).next).toMatchSnapshot();
  });

  it("a fresh deck contains exactly 48 cards", () => {
    expect(generateDeck()).toHaveLength(48);
  });

  it("every card has two tiles; each tile has a terrain and a crown value", () => {
    generateCardMap().forEach((card) => {
      expect(card.tiles).toHaveLength(2);
      card.tiles.forEach((tile) => {
        expect(typeof tile.tile).toBe("number");
        expect(typeof tile.value).toBe("number");
      });
    });
  });

  it("dealing with the same seed yields the same four cards", () => {
    const { next: hand1 } = getNextFourCards(SEED_SAME);
    const { next: hand2 } = getNextFourCards(SEED_SAME);
    expect(hand1).toEqual(hand2);
  });

  it("dealing with different seeds yields different four cards", () => {
    const { next: hand1 } = getNextFourCards(SEED_A);
    const { next: hand2 } = getNextFourCards(SEED_B);
    expect(hand1).not.toEqual(hand2);
  });

  it("a dealt hand excludes cards already drawn from the deck", () => {
    const { next: first, remaining } = getNextFourCards(SEED_A, generateDeck());
    first.forEach((id) => expect(remaining).not.toContain(id));
  });
});
