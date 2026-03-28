// Section 1 — Deck
import { describe, expect, it } from "vitest";
import { generateCardMap, generateDeck } from "kingdomino-engine";
import { getNextFourCards } from "kingdomino-engine";

describe("Deck", () => {
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
    const { next: hand1 } = getNextFourCards("42");
    const { next: hand2 } = getNextFourCards("42");
    expect(hand1).toEqual(hand2);
  });

  it("dealing with different seeds yields different four cards", () => {
    const { next: hand1 } = getNextFourCards("1");
    const { next: hand2 } = getNextFourCards("2");
    expect(hand1).not.toEqual(hand2);
  });

  it("a dealt hand excludes cards already drawn from the deck", () => {
    const { next: first, remaining } = getNextFourCards("1", generateDeck());
    first.forEach((id) => expect(remaining).not.toContain(id));
  });
});
