// Sections 4+5 — Deal and Round
import { describe, expect, it } from "vitest";
import { Deal } from "../state/Deal";
import { Round } from "../state/Round";
import { Player } from "../state/Player";
import { right, left } from "kingdomino-engine";

// Helpers
const alice = () => new Player("alice", true);
const bob = () => new Player("bob", false);

const makeDeal = () => new Deal([34, 3, 32, 26]); // will sort to [3, 26, 32, 34]

const makeRound = () => {
  const a = alice();
  const b = bob();
  const round = new Round(new Deal([3, 26, 32, 34]), [a, b]);
  return { round, alice: a, bob: b };
};

// ── Section 4: Deal ──────────────────────────────────────────────────────────

describe("Deal", () => {
  it("slots are sorted by card id ascending after construction", () => {
    const ids = makeDeal()
      .snapshot()
      .map((s) => s.cardId);
    expect(ids).toEqual([3, 26, 32, 34]);
  });

  it("a player can pick an unclaimed card", () => {
    const deal = makeDeal();
    const a = alice();
    deal.pickByCardId(a, 26);
    expect(deal.pickedCardFor(a)).toBe(26);
  });

  it("picking an already-claimed card throws", () => {
    const deal = makeDeal();
    deal.pickByCardId(alice(), 26);
    expect(() => deal.pickByCardId(bob(), 26)).toThrow();
  });

  it("nextRoundPickOrder lists players in ascending slot (card id) order of their picks", () => {
    const deal = makeDeal(); // slots: [3, 26, 32, 34]
    const a = alice();
    const b = bob();
    deal.pickByCardId(a, 32); // alice: slot 2
    deal.pickByCardId(b, 3); // bob:   slot 0  → bob goes before alice
    const order = deal.nextRoundPickOrder().map((p) => p.id);
    expect(order).toEqual(["bob", "alice"]);
  });
});

// ── Section 5: Round ─────────────────────────────────────────────────────────

describe("Round", () => {
  it("starts in picking phase with the first player as currentActor", () => {
    const { round, alice } = makeRound();
    expect(round.phase).toBe("picking");
    expect(round.currentActor?.id).toBe(alice.id);
  });

  it("moves to placing phase after a player picks, with that same player still the actor", () => {
    const { round, alice } = makeRound();
    round.recordPick(alice, 26);
    expect(round.phase).toBe("placing");
    expect(round.currentActor?.id).toBe(alice.id);
  });

  it("returns to picking for the next player after a player places", () => {
    const { round, alice, bob } = makeRound();
    round.recordPick(alice, 26);
    round.recordPlacement(alice, 7, 6, right);
    expect(round.phase).toBe("picking");
    expect(round.currentActor?.id).toBe(bob.id);
  });

  it("reaches complete after all players have picked and placed", () => {
    const { round, alice, bob } = makeRound();
    round.recordPick(alice, 26);
    round.recordPlacement(alice, 7, 6, right);
    round.recordPick(bob, 32);
    round.recordPlacement(bob, 5, 6, left);
    expect(round.phase).toBe("complete");
  });

  it("picking out of turn throws", () => {
    const { round, bob } = makeRound();
    expect(() => round.recordPick(bob, 26)).toThrow();
  });

  it("placing during the picking phase throws", () => {
    const { round, alice } = makeRound();
    expect(() => round.recordPlacement(alice, 7, 6, right)).toThrow();
  });

  it.todo("placing in a position that violates board rules throws");
});
