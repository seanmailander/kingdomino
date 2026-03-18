// Sections 6–9 — GameSession (turn flow, events, full round, end of game)
//
// completeRound helper deals [2, 18, 26, 44] (sorted order) and drives both players
// through a full pick-and-place cycle:
//   alice picks card 44 (mine 2-crown/grain) and places east of castle
//     → mine region: 1 cell × 2 crowns = score 2
//   bob   picks card 26 (wood 1-crown/grain) and places west of castle
//     → wood region: 1 cell × 1 crown  = score 1
// Because alice picked slot 3 (card 44) and bob picked slot 2 (card 26),
// bob's lower slot means bob leads pick order in the next round.
import { describe, expect, it } from "vitest";
import { GameSession, Player } from "../state/GameSession";
import { right, left } from "../gamelogic/cards";
import { findPlacementWithin5x5 } from "../gamelogic/board";
import { getNextFourCards } from "../gamelogic/utils";
import type { Direction } from "../state/types";

const makeSession = () => {
  const session = new GameSession();
  const alice = new Player("alice", true);
  const bob = new Player("bob", false);
  session.addPlayer(alice);
  session.addPlayer(bob);
  session.startGame([alice, bob]);
  return { session, alice, bob };
};

const completeRound = (session: GameSession, alice: Player, bob: Player) => {
  session.beginRound([2, 18, 26, 44]);
  session.handleLocalPick(44); // alice: mine(2cr)/grain
  session.handleLocalPlacement(7, 6, right); //   mine+2cr at (7,6), grain at (8,6)
  session.handlePick(bob.id, 26); // bob: wood(1cr)/grain
  session.handlePlacement(bob.id, 5, 6, left); // wood+1cr at (5,6), grain at (4,6)
};

const playOutRound = (session: GameSession) => {
  while (session.currentRound) {
    const actor = session.currentRound.currentActor;
    expect(actor).toBeTruthy();

    const openSlots = session.currentRound.deal
      .snapshot()
      .filter((slot) => slot.pickedBy === null)
      .map((slot) => slot.cardId);

    const pickCandidates = [...openSlots].sort((a, b) => b - a);
    let cardToPick: number | null = null;
    let chosenPlacement: { x: number; y: number; direction: Direction } | null = null;
    for (const candidate of pickCandidates) {
      const placement = findPlacementWithin5x5(actor!.board.snapshot(), candidate);
      if (placement) {
        cardToPick = candidate;
        chosenPlacement = placement;
        break;
      }
    }

    expect(cardToPick).not.toBeNull();
    expect(chosenPlacement).toBeTruthy();
    session.handlePick(actor!.id, cardToPick);
    session.handlePlacement(
      actor!.id,
      chosenPlacement!.x,
      chosenPlacement!.y,
      chosenPlacement!.direction,
    );
  }
};

// ── Section 6: Turn flow ─────────────────────────────────────────────────────

describe("GameSession — turn flow", () => {
  it("isMyTurn is true for the local player at the start of a round", () => {
    const { session } = makeSession();
    session.beginRound([3, 26, 32, 34]);
    expect(session.isMyTurn()).toBe(true);
    expect(session.isMyPlace()).toBe(false);
  });

  it("isMyTurn is false and isMyPlace is true after the local player picks", () => {
    const { session } = makeSession();
    session.beginRound([3, 26, 32, 34]);
    session.handleLocalPick(26);
    expect(session.isMyTurn()).toBe(false);
    expect(session.isMyPlace()).toBe(true);
  });

  it("localCardToPlace returns the card id the local player picked", () => {
    const { session } = makeSession();
    session.beginRound([3, 26, 32, 34]);
    session.handleLocalPick(26);
    expect(session.localCardToPlace()).toBe(26);
  });

  it("after the local player places, it becomes the next player's turn", () => {
    const { session, bob } = makeSession();
    session.beginRound([3, 26, 32, 34]);
    session.handleLocalPick(26);
    session.handleLocalPlacement(7, 6, right);
    expect(session.isMyTurn()).toBe(false);
    expect(session.currentRound?.currentActor?.id).toBe(bob.id);
  });
});

// ── Section 7: Events ────────────────────────────────────────────────────────

describe("GameSession — events", () => {
  it("pick:made fires with the correct card id when the local player picks", () => {
    const { session } = makeSession();
    session.beginRound([3, 26, 32, 34]);
    const picked: number[] = [];
    session.events.on("pick:made", ({ cardId }) => picked.push(cardId));
    session.handleLocalPick(26);
    expect(picked).toEqual([26]);
  });

  it("place:made fires with the correct card id and coordinates when the local player places", () => {
    const { session } = makeSession();
    session.beginRound([3, 26, 32, 34]);
    session.handleLocalPick(26);
    const placements: Array<{ cardId: number; x: number; y: number }> = [];
    session.events.on("place:made", ({ cardId, x, y }) => placements.push({ cardId, x, y }));
    session.handleLocalPlacement(7, 6, right);
    expect(placements).toEqual([{ cardId: 26, x: 7, y: 6 }]);
  });

  it("round:complete fires exactly once after all players finish their pick and place", () => {
    const { session, alice, bob } = makeSession();
    let count = 0;
    session.events.on("round:complete", () => count++);
    completeRound(session, alice, bob);
    expect(count).toBe(1);
  });

  it("game:ended fires when endGame is called, reporting every player's score", () => {
    const { session, alice, bob } = makeSession();
    completeRound(session, alice, bob);
    const playerIds: string[] = [];
    session.events.on("game:ended", ({ scores }) =>
      scores.forEach(({ player }) => playerIds.push(player.id)),
    );
    session.endGame();
    expect(playerIds).toContain(alice.id);
    expect(playerIds).toContain(bob.id);
  });
});

// ── Section 8: Full round ────────────────────────────────────────────────────

describe("GameSession — full round", () => {
  it("completing a round accumulates one placement on each player's board", () => {
    const { session, alice, bob } = makeSession();
    completeRound(session, alice, bob);
    expect(alice.board.placements).toHaveLength(1);
    expect(bob.board.placements).toHaveLength(1);
  });

  it("currentRound is null after a round completes", () => {
    const { session, alice, bob } = makeSession();
    completeRound(session, alice, bob);
    expect(session.currentRound).toBeNull();
  });

  it("scores after a completed round reflect placed tiles and crowns", () => {
    const { session, alice, bob } = makeSession();
    completeRound(session, alice, bob);
    // alice placed mine(2cr) → 1×2=2; bob placed wood(1cr) → 1×1=1
    expect(alice.score()).toBe(2);
    expect(bob.score()).toBe(1);
  });

  it("pick order in the next round follows the card-id slot order of the previous round's picks", () => {
    const { session, alice, bob } = makeSession();
    // alice picked slot 3 (card 44), bob picked slot 2 (card 26) → bob leads next round
    completeRound(session, alice, bob);
    expect(session.pickOrder[0].id).toBe(bob.id);
    expect(session.pickOrder[1].id).toBe(alice.id);
  });
});

// ── Section 9: End of game ───────────────────────────────────────────────────

describe("GameSession — end of game", () => {
  it.todo("a session with no cards remaining cannot begin another round");

  it("final scores in game:ended reflect all accumulated placements", () => {
    const { session, alice, bob } = makeSession();
    completeRound(session, alice, bob);
    let scores: Array<{ playerId: string; score: number }> = [];
    session.events.on("game:ended", ({ scores: s }) => {
      scores = s.map(({ player, score }) => ({ playerId: player.id, score }));
    });
    session.endGame();
    expect(scores.find((r) => r.playerId === alice.id)?.score).toBe(2);
    expect(scores.find((r) => r.playerId === bob.id)?.score).toBe(1);
  });

  it("the player with the highest score is reported first in the final results", () => {
    const { session, alice, bob } = makeSession();
    completeRound(session, alice, bob); // alice=2, bob=1
    let topPlayerId = "";
    session.events.on("game:ended", ({ scores }) => {
      topPlayerId = scores[0].player.id;
    });
    session.endGame();
    expect(topPlayerId).toBe(alice.id);
  });

  it("simulates a full game end to end and emits sorted final scores", () => {
    const { session, alice, bob } = makeSession();

    let remainingDeck: number[] | undefined;
    let completedRounds = 0;
    let endedEvents = 0;
    let finalScores: Array<{ playerId: string; score: number }> = [];

    session.events.on("round:complete", () => {
      completedRounds++;
    });

    session.events.on("game:ended", ({ scores }) => {
      endedEvents++;
      finalScores = scores.map(({ player, score }) => ({ playerId: player.id, score }));
    });

    for (let roundIndex = 0; ; roundIndex++) {
      const { next, remaining } = getNextFourCards(`full-game-seed-${roundIndex}`, remainingDeck);
      session.beginRound(next as [number, number, number, number]);
      playOutRound(session);
      remainingDeck = remaining;
      if (remainingDeck.length === 0) break;
    }

    session.endGame();

    expect(session.phase).toBe("finished");
    expect(completedRounds).toBe(12);
    expect(alice.board.placements).toHaveLength(12);
    expect(bob.board.placements).toHaveLength(12);
    expect(endedEvents).toBe(1);
    expect(finalScores).toHaveLength(2);
    expect(finalScores[0].score).toBeGreaterThanOrEqual(finalScores[1].score);
    expect(finalScores.map((s) => s.playerId).sort()).toEqual([alice.id, bob.id].sort());
  });
});
