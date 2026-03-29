// Section 10 — Discard rule
//
// When a player's picked domino has no legal placement on their 5×5 kingdom,
// they must discard it.  The domino is removed from play (board unchanged),
// and the round continues normally.
//
// Board setup for "unplaceable" tests: castle at (6,6) surrounded by
// non-marsh/non-mine terrain in all four orthogonal directions.
// Card 46 (marsh/mine, type = marsh^mine = 48) requires adjacency to marsh
// or mine; with only grain/water/grass neighbours, it is unplaceable.
import { describe, expect, it } from "vitest";
import { GameSession, Player } from "./GameSession";
import { left, right } from "kingdomino-engine";

const BLOCKED_CARD = 46 as const; // marsh/mine — requires marsh or mine adjacency

/** Board with castle completely surrounded by non-matching terrain for card 46. */
const seedBlockedBoard = (player: Player) => {
  player.board.place(0, 7, 6, right); // grain/grain east:  (7,6)(8,6)
  player.board.place(1, 5, 6, left); //  grain/grain west:  (5,6)(4,6)
  player.board.place(6, 6, 7, "down"); // water/water south: (6,7)(6,8)
  player.board.place(9, 6, 5, "up"); //  grass/grass north: (6,5)(6,4)
};

const makeSession = () => {
  const session = new GameSession({ localPlayerId: "alice" });
  const alice = new Player("alice");
  const bob = new Player("bob");
  session.addPlayer(alice);
  session.addPlayer(bob);
  session.startGame([alice, bob]);
  return { session, alice, bob };
};

describe("GameSession — discard rule", () => {
  it("round advances to the next player's pick turn after a discard", () => {
    const { session, alice, bob } = makeSession();
    seedBlockedBoard(alice);
    session.beginRound([2, 18, BLOCKED_CARD, 44]);
    session.handleLocalPick(BLOCKED_CARD);
    session.handleDiscard(alice.id);
    expect(session.currentRound?.phase).toBe("picking");
    expect(session.currentRound?.currentActor?.id).toBe(bob.id);
  });

  it("board remains unchanged after a discard", () => {
    const { session, alice } = makeSession();
    seedBlockedBoard(alice);
    const placementsBeforeDiscard = alice.board.placements.length;
    session.beginRound([2, 18, BLOCKED_CARD, 44]);
    session.handleLocalPick(BLOCKED_CARD);
    session.handleDiscard(alice.id);
    expect(alice.board.placements).toHaveLength(placementsBeforeDiscard);
  });

  it("discard:made event fires with correct player and cardId", () => {
    const { session, alice } = makeSession();
    seedBlockedBoard(alice);
    session.beginRound([2, 18, BLOCKED_CARD, 44]);
    session.handleLocalPick(BLOCKED_CARD);
    const discards: Array<{ playerId: string; cardId: number }> = [];
    session.events.on("discard:made", ({ player, cardId }) =>
      discards.push({ playerId: player.id, cardId }),
    );
    session.handleDiscard(alice.id);
    expect(discards).toEqual([{ playerId: "alice", cardId: BLOCKED_CARD }]);
  });

  it("round:complete fires after all players finish (mix of place and discard)", () => {
    const { session, alice, bob } = makeSession();
    seedBlockedBoard(alice);
    let roundCompleteCount = 0;
    session.events.on("round:complete", () => roundCompleteCount++);
    session.beginRound([2, 18, BLOCKED_CARD, 44]);
    session.handleLocalPick(BLOCKED_CARD);
    session.handleDiscard(alice.id);
    session.handlePick(bob.id, 44);
    session.handlePlacement(bob.id, 7, 6, right);
    expect(roundCompleteCount).toBe(1);
    expect(session.currentRound).toBeNull();
  });

  it("handleDiscard throws when the player has not yet picked a card", () => {
    const { session, alice } = makeSession();
    seedBlockedBoard(alice);
    session.beginRound([2, 18, BLOCKED_CARD, 44]);
    // alice hasn't picked yet — no card to discard
    expect(() => session.handleDiscard(alice.id)).toThrow();
  });

  it("handleDiscard throws when the player has a valid legal placement", () => {
    const { session, alice } = makeSession();
    // Fresh board: card 2 (wood/wood) can be placed adjacent to castle
    session.beginRound([2, 18, BLOCKED_CARD, 44]);
    session.handleLocalPick(2);
    expect(() => session.handleDiscard(alice.id)).toThrow(/valid placement/i);
  });

  it("handleLocalDiscard works as a convenience alias for the local player", () => {
    const { session, alice } = makeSession();
    seedBlockedBoard(alice);
    session.beginRound([2, 18, BLOCKED_CARD, 44]);
    session.handleLocalPick(BLOCKED_CARD);
    expect(() => session.handleLocalDiscard()).not.toThrow();
    expect(alice.board.placements).toHaveLength(4); // unchanged
  });
});
