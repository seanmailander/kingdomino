import { Deal, GameSession, Player, Round } from "./GameSession";
import { describe, expect, it } from "vitest";
import { left, right } from "../gamelogic/cards";

describe("Deal", () => {
  it("sorts slots by card id ascending", () => {
    const deal = new Deal([34, 3, 32, 26]);
    const ids = deal.snapshot().map((s) => s.cardId);
    expect(ids).toEqual([3, 26, 32, 34]);
  });

  it("records a pick and returns the card for that player", () => {
    const deal = new Deal([3, 26, 32, 34]);
    const alice = new Player("alice", true);
    deal.pickByCardId(alice, 26);
    expect(deal.pickedCardFor(alice)).toBe(26);
  });

  it("throws when picking an already-claimed card", () => {
    const deal = new Deal([3, 26, 32, 34]);
    const alice = new Player("alice", true);
    const bob = new Player("bob", false);
    deal.pickByCardId(alice, 26);
    expect(() => deal.pickByCardId(bob, 26)).toThrow();
  });

  it("derives next-round pick order by slot position (low card id first)", () => {
    const deal = new Deal([3, 26, 32, 34]);
    const alice = new Player("alice", true);
    const bob = new Player("bob", false);
    deal.pickByCardId(alice, 32);
    deal.pickByCardId(bob, 3);
    const order = deal.nextRoundPickOrder().map((p) => p.id);
    expect(order).toEqual(["bob", "alice"]);
  });
});

describe("Round", () => {
  const makeRound = () => {
    const alice = new Player("alice", true);
    const bob = new Player("bob", false);
    const deal = new Deal([3, 26, 32, 34]);
    const round = new Round(deal, [alice, bob]);
    return { round, alice, bob, deal };
  };

  it("starts in picking phase with alice as the current actor", () => {
    const { round, alice } = makeRound();
    expect(round.phase).toBe("picking");
    expect(round.currentActor?.id).toBe(alice.id);
  });

  it("moves to placing after alice picks", () => {
    const { round, alice } = makeRound();
    round.recordPick(alice, 26);
    expect(round.phase).toBe("placing");
    expect(round.currentActor?.id).toBe(alice.id);
  });

  it("moves to next picker after alice places", () => {
    const { round, alice, bob } = makeRound();
    round.recordPick(alice, 26);
    round.recordPlacement(alice, 7, 6, right);
    expect(round.phase).toBe("picking");
    expect(round.currentActor?.id).toBe(bob.id);
  });

  it("reaches complete after all players pick and place", () => {
    const { round, alice, bob } = makeRound();
    round.recordPick(alice, 26);
    round.recordPlacement(alice, 7, 6, right);
    round.recordPick(bob, 32);
    round.recordPlacement(bob, 5, 6, left);
    expect(round.phase).toBe("complete");
  });

  it("throws when picking out of turn", () => {
    const { round, bob } = makeRound();
    expect(() => round.recordPick(bob, 26)).toThrow();
  });

  it("throws when placing in picking phase", () => {
    const { round, alice } = makeRound();
    expect(() => round.recordPlacement(alice, 7, 6, right)).toThrow();
  });
});

describe("GameSession", () => {
  const makeSession = () => {
    const session = new GameSession();
    const alice = new Player("alice", true);
    const bob = new Player("bob", false);
    session.addPlayer(alice);
    session.addPlayer(bob);
    session.startGame([alice, bob]);
    return { session, alice, bob };
  };

  it("reports isMyTurn for the local player when it is their pick turn", () => {
    const { session } = makeSession();
    session.beginRound([3, 26, 32, 34]);
    expect(session.isMyTurn()).toBe(true);
    expect(session.isMyPlace()).toBe(false);
  });

  it("reports isMyPlace after local player picks", () => {
    const { session } = makeSession();
    session.beginRound([3, 26, 32, 34]);
    session.handleLocalPick(26);
    expect(session.isMyTurn()).toBe(false);
    expect(session.isMyPlace()).toBe(true);
    expect(session.localCardToPlace()).toBe(26);
  });

  it("fires pick:made event when local player picks", () => {
    const { session } = makeSession();
    session.beginRound([3, 26, 32, 34]);
    const events: number[] = [];
    session.events.on("pick:made", (e) => events.push(e.cardId));
    session.handleLocalPick(26);
    expect(events).toEqual([26]);
  });

  it("fires round:complete and clears currentRound when all players finish", () => {
    const { session, bob } = makeSession();
    session.beginRound([3, 26, 32, 34]);
    let roundCompleteCount = 0;
    session.events.on("round:complete", () => roundCompleteCount++);

    session.handleLocalPick(26);
    session.handleLocalPlacement(7, 6, right);
    session.handlePick(bob.id, 32);
    session.handlePlacement(bob.id, 5, 6, left);

    expect(roundCompleteCount).toBe(1);
    expect(session.currentRound).toBeNull();
  });

  it("accumulates placements on player boards", () => {
    const { session, alice, bob } = makeSession();
    session.beginRound([3, 26, 32, 34]);
    session.handleLocalPick(26);
    session.handleLocalPlacement(7, 6, right);
    session.handlePick(bob.id, 32);
    session.handlePlacement(bob.id, 5, 6, left);

    expect(alice.board.placements).toHaveLength(1);
    expect(bob.board.placements).toHaveLength(1);
  });
});
