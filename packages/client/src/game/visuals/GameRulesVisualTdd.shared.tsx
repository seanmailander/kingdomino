import React, { useEffect, useMemo, useRef, useState } from "react";

import { App } from "../../App/App";
import { resetAppState, triggerLobbyLeave, triggerLobbyStart, useApp, getCurrentSession } from "../../App/store";
import type { RosterConfig } from "../../Lobby/lobby.types";
import { SLOT_LOCAL, SLOT_AI } from "../../Lobby/lobby.types";
import {
  findPlacementWithin5x5,
  getEligiblePositions,
  getValidDirections,
  staysWithin5x5,
  hashIt,
  MIGHTY_DUEL,
  ROUND_PHASE_PICKING,
  ROUND_PHASE_PLACING,
  ROUND_STARTED,
  PICK_MADE,
  PLACE_MADE,
  DISCARD_MADE,
  ROUND_COMPLETE,
  GAME_ENDED,
} from "kingdomino-engine";
import type { CardId, GameVariant, PlayerId, SeedProvider } from "kingdomino-engine";
import type { GameBonuses } from "kingdomino-engine";
import type { BoardPlacement, BoardGrid } from "kingdomino-engine";
import { LobbyFlow } from "../state/game.flow";
import { AppFlowAdapter } from "../../App/AppFlowAdapter";
import type { TestConnectionScenario } from "kingdomino-protocol";
import type { Direction } from "kingdomino-engine";
import type { PlayerActor, PlacementResult } from "kingdomino-protocol";
import { LocalPlayerActor } from "../state/local.player.actor";
import type { RosterFactory, RosterResult } from "../state/RosterFactory";

type HandshakeScript = {
  localSecret: number;
  remoteSecret: number;
  remoteCommittment?: string;
};

type LocalMoveScript = {
  card?: number;
  cardIndex?: number;
  discard?: boolean;
  x?: number;
  y?: number;
  direction?: Direction;
  placements?: ReadonlyArray<
    { x: number; y: number; direction: Direction } | { mode: "overflow" | "legal" }
  >;
};

type EventLogEntry = {
  label: string;
  detail: string;
};

export type RealGameScenario = {
  me?: string;
  them?: string;
  autoStart?: boolean;
  roundLimit?: number;
  variant?: GameVariant;
  bonuses?: GameBonuses;
  localBoardPlacements?: ReadonlyArray<BoardPlacement>;
  handshakes: ReadonlyArray<HandshakeScript>;
  localMoves: ReadonlyArray<LocalMoveScript>;
  remoteMoves: TestConnectionScenario["moves"];
  remoteControl?: TestConnectionScenario["control"];
};

export const TIE_BREAK_SCENARIO: RealGameScenario = {
  // Two-round game. Scores depend on ChaCha RNG card distribution; use snapshot assertions.
  // Round 1 deal (hashIt(30^800)): [#12, #17, #35, #39]. Pick order (hashIt(11^101)): them first.
  // Round 2 deal (hashIt(20^700)): [#7, #30, #31, #44]. Pick order continues from R1 picks.
  roundLimit: 2,
  handshakes: [
    { localSecret: 11, remoteSecret: 101 },  // pick-order seed
    { localSecret: 30, remoteSecret: 800 },  // round 1 deal
    { localSecret: 20, remoteSecret: 700 },  // round 2 deal
  ],
  localMoves: [
    { cardIndex: 0, x: 7, y: 6, direction: "right" },        // R1: pick lowest available
    { cardIndex: 0, placements: [{ mode: "legal" }] },        // R2: pick lowest available
  ],
  remoteMoves: [
    { cardIndex: 0, x: 6, y: 5, direction: "up" },           // R1: them picks lowest
    { cardIndex: 0, x: 7, y: 6, direction: "right" },        // R2: them picks lowest
  ],
};

export const FIRST_ROUND_RULE_SCENARIO: RealGameScenario = {
  // Deal (hashIt(22^202)): [#1, #9, #10, #24]. Pick order (hashIt(11^101)): them first.
  // them picks #1 (grain/grain, 0cr). me picks cardIndex 2 → #24 (wood+1cr/grain) → score 1.
  roundLimit: 1,
  handshakes: [
    { localSecret: 11, remoteSecret: 101 },
    { localSecret: 22, remoteSecret: 202 },
  ],
  localMoves: [{ cardIndex: 2, x: 6, y: 5, direction: "up" }],
  remoteMoves: [{ cardIndex: 0, x: 6, y: 5, direction: "up" }],
};

export const PLACEMENT_CONNECT_LEGALITY_SCENARIO: RealGameScenario = {
  roundLimit: 1,
  handshakes: [
    { localSecret: 11, remoteSecret: 101 },
    { localSecret: 22, remoteSecret: 202 },
  ],
  localMoves: [
    {
      cardIndex: 2,
      placements: [
        { x: 0, y: 0, direction: "right" },
        { x: 6, y: 5, direction: "up" },
      ],
    },
  ],
  remoteMoves: [{ cardIndex: 0, x: 6, y: 5, direction: "up" }],
};

export const GRID_BOUNDARY_RULE_SCENARIO: RealGameScenario = {
  roundLimit: 1,
  localBoardPlacements: [
    { card: 46, x: 7, y: 4, direction: "right" },
    { card: 9, x: 7, y: 5, direction: "right" },
    { card: 6, x: 7, y: 6, direction: "right" },
    { card: 0, x: 7, y: 7, direction: "right" },
    { card: 2, x: 7, y: 8, direction: "right" },
    { card: 11, x: 5, y: 4, direction: "left" },
  ],
  handshakes: [
    { localSecret: 11, remoteSecret: 101 },
    { localSecret: 22, remoteSecret: 202 },
  ],
  localMoves: [{ cardIndex: 0, placements: [{ mode: "overflow" }, { mode: "legal" }] }],
  remoteMoves: [{ cardIndex: 0, x: 6, y: 5, direction: "up" }],
};

// Board pre-filled with non-marsh/non-mine terrain on all 4 castle-adjacent
// positions. The deal (hashIt(1^115)) = [#0, #1, #6, #46] ensures card #46
// (marsh/mine) is available. Card 46 has no eligible neighbour and must be discarded.
export const DISCARD_WHEN_UNPLACEABLE_SCENARIO: RealGameScenario = {
  roundLimit: 1,
  localBoardPlacements: [
    { card: 0, x: 7, y: 6, direction: "right" }, // grain/grain east  (7,6)(8,6)
    { card: 1, x: 5, y: 6, direction: "left" }, //  grain/grain west  (5,6)(4,6)
    { card: 6, x: 6, y: 7, direction: "down" }, //  water/water south (6,7)(6,8)
    { card: 9, x: 6, y: 5, direction: "up" }, //    grass/grass north (6,5)(6,4)
  ],
  handshakes: [
    { localSecret: 11, remoteSecret: 101 },  // pick-order seed: them first
    { localSecret: 1, remoteSecret: 115 },   // deal: [#0, #1, #6, #46]
  ],
  localMoves: [{ card: 46, discard: true }],
  remoteMoves: [{ cardIndex: 0, x: 6, y: 5, direction: "up" }],
};

// Board pre-filled with wood/wood cards to the east, spanning columns 7–10
// (width from castle=6 to 10 is 5 = exactly 5×5). The local player then places
// a wood card at (11,6)→right, expanding width to 7. This is valid in 7×7
// Mighty Duel but would be rejected in standard 5×5 mode.
// Deal (hashIt(22^202)): [#1, #9, #10, #24]. Pick order: them first.
// them picks cardIndex 0 → #1 (grain/grain). me picks cardIndex 2 → #24 (wood+1cr/grain).
export const MIGHTY_DUEL_SCENARIO: RealGameScenario = {
  variant: MIGHTY_DUEL,
  roundLimit: 1,
  localBoardPlacements: [
    { card: 2, x: 7, y: 6, direction: "right" }, // wood at (7,6)(8,6)
    { card: 3, x: 9, y: 6, direction: "right" }, // wood at (9,6)(10,6)
  ],
  handshakes: [
    { localSecret: 11, remoteSecret: 101 },
    { localSecret: 22, remoteSecret: 202 },
  ],
  localMoves: [{ cardIndex: 2, x: 11, y: 6, direction: "right" }],
  remoteMoves: [{ cardIndex: 0, x: 6, y: 5, direction: "up" }],
};

// Pre-seed me's board with 4 symmetric placements to form a centred 5×5 kingdom:
//   East:  grain at (7,6)+(8,6)   West: grain at (5,6)+(4,6)
//   South: wood  at (6,7)+(6,8)   North: wood  at (6,5)+(6,4)
// Bounding box: x ∈ [4,8], y ∈ [4,8] → minX+maxX=12, minY+maxY=12 → centred.
// Deal (hashIt(30^800)): [#12, #17, #35, #39]. Pick order: them first.
// them picks cardIndex 0 → #12 (grain/wood, 0cr). me picks cardIndex 0 → #17 (wood/grass, 0cr).
// me places #17 (wood tile) at (7,5)→right: connects to wood at (6,5), stays within [4,8]×[4,8].
// Kingdom stays centred (+10 MK). Neither player discards → both earn Harmony (+5).
// Final: me = 0 base + 10 MK + 5 harmony = 15; them = 0 base + 0 MK + 5 harmony = 5.
export const BONUS_SCENARIO: RealGameScenario = {
  bonuses: { middleKingdom: true, harmony: true },
  roundLimit: 1,
  localBoardPlacements: [
    { card: 0, x: 7, y: 6, direction: "right" }, // grain east:  (7,6),(8,6)
    { card: 1, x: 5, y: 6, direction: "left" },  // grain west:  (5,6),(4,6)
    { card: 2, x: 6, y: 7, direction: "down" },  // wood south:  (6,7),(6,8)
    { card: 3, x: 6, y: 5, direction: "up" },    // wood north:  (6,5),(6,4)
  ],
  handshakes: [
    { localSecret: 11, remoteSecret: 101 }, // pick-order seed: them first
    { localSecret: 30, remoteSecret: 800 }, // round 1 deal: [#12, #17, #35, #39]
  ],
  localMoves: [{ cardIndex: 0, x: 7, y: 5, direction: "right" }], // #17 wood at (7,5),(8,5) — stays within bounds
  remoteMoves: [{ cardIndex: 0, x: 6, y: 5, direction: "up" }],   // #12 on their empty board
};

// Scenario where game is in progress; remote peer will ack any pause request.
// Use with triggerPauseIntent() in story play to reach GamePaused state.
export const PAUSABLE_GAME_SCENARIO: RealGameScenario = {
  handshakes: [
    { localSecret: 11, remoteSecret: 101 }, // pick-order seed (local picks first)
    { localSecret: 22, remoteSecret: 202 }, // round 1 seed
    { localSecret: 33, remoteSecret: 303 }, // round 2 seed (if resumed)
  ],
  localMoves: [],
  remoteMoves: [],
  remoteControl: { respondToPauseRequest: true, respondToResumeRequest: true },
};

export type RuleScenarioProps = {
  title: string;
  ruleFocus: string;
  given: string;
  when: string;
  expectedOutcome: string;
};

// ── Seed provider ──────────────────────────────────────────────────────────────

/**
 * Produces the same deterministic seeds as the old commitment protocol did for
 * these fixed secrets: seed = hashIt(localSecret ^ remoteSecret).
 * This ensures story scenarios see the same card deals and pick orders as before.
 */
class SequentialSeedProvider implements SeedProvider {
  private readonly seeds: Promise<string>[];
  private index = 0;
  private readonly onExhausted?: () => void;

  constructor(handshakes: ReadonlyArray<HandshakeScript>, onExhausted?: () => void) {
    this.seeds = handshakes.map(({ localSecret, remoteSecret }) =>
      hashIt(localSecret ^ remoteSecret),
    );
    this.onExhausted = onExhausted;
  }

  async nextSeed(): Promise<string> {
    const seed = await this.seeds[this.index];
    if (seed === undefined) {
      // Seeds exhausted — signal the scenario end and block the engine loop.
      this.onExhausted?.();
      return new Promise<string>(() => { /* never resolves */ });
    }
    this.index++;
    return seed;
  }
}

// ── Scripted remote player actor ───────────────────────────────────────────────

type ScriptedMove = TestConnectionScenario["moves"][number];

/**
 * A PlayerActor that replays scripted moves. Used for the remote player in
 * visual TDD scenarios where moves are predetermined.
 */
class ScriptedPlayerActor implements PlayerActor {
  readonly playerId: PlayerId;
  private readonly moves: ReadonlyArray<ScriptedMove>;
  private roundIndex = 0;

  constructor(playerId: PlayerId, moves: ReadonlyArray<ScriptedMove>) {
    this.playerId = playerId;
    this.moves = moves;
  }

  async awaitPick(availableCards: CardId[], _boardSnapshot: BoardGrid): Promise<CardId> {
    const move = this.moves[this.roundIndex];
    if (!move) throw new Error(`ScriptedPlayerActor: no move for round ${this.roundIndex + 1}`);

    if (move.card !== undefined) return move.card as CardId;
    if (move.cardIndex !== undefined) {
      const cardId = availableCards[move.cardIndex];
      if (cardId === undefined) {
        throw new Error(`ScriptedPlayerActor: cardIndex ${move.cardIndex} out of range`);
      }
      return cardId;
    }
    throw new Error(`ScriptedPlayerActor: no card or cardIndex for round ${this.roundIndex + 1}`);
  }

  async awaitPlacement(_cardId: CardId, _boardSnapshot: BoardGrid): Promise<PlacementResult> {
    const round = this.roundIndex + 1;
    const move = this.moves[this.roundIndex];
    this.roundIndex++;

    if (!move) throw new Error(`ScriptedPlayerActor: no move for placement`);
    if (move.discard) return { discard: true };

    const missingFields: string[] = [];
    if (move.x === undefined) missingFields.push("x");
    if (move.y === undefined) missingFields.push("y");
    if (move.direction === undefined) missingFields.push("direction");

    if (missingFields.length > 0) {
      throw new Error(
        `ScriptedPlayerActor: missing ${missingFields.join("/")} for round ${round}`,
      );
    }

    return {
      x: move.x!,
      y: move.y!,
      direction: move.direction as Direction,
    };
  }

  destroy(): void { /* no-op */ }
}

// ── Story roster factory ───────────────────────────────────────────────────────

/**
 * A RosterFactory for visual TDD stories. Creates a LocalPlayerActor for the
 * local player and a ScriptedPlayerActor for the remote player, with a
 * SequentialSeedProvider for deterministic seeds.
 */
class StoryRosterFactory implements RosterFactory {
  private readonly scenario: RealGameScenario;
  /** Exposed so ScriptedLocalPlayer can resolve picks/placements on the actor. */
  localActor: LocalPlayerActor | null = null;

  constructor(scenario: RealGameScenario) {
    this.scenario = scenario;
  }

  async build(_config: RosterConfig): Promise<RosterResult> {
    const meId = (this.scenario.me ?? "me") as PlayerId;
    const themId = (this.scenario.them ?? "them") as PlayerId;

    const localActor = new LocalPlayerActor(meId);
    this.localActor = localActor;

    const remoteActor = new ScriptedPlayerActor(themId, this.scenario.remoteMoves);

    const seedProvider = new SequentialSeedProvider(
      this.scenario.handshakes,
      () => getCurrentSession()?.endGame(),
    );

    return {
      players: [
        { id: meId, actor: localActor },
        { id: themId, actor: remoteActor },
      ],
      seedProvider,
      localPlayerId: meId,
    };
  }
}

// ── Scripted local player component ────────────────────────────────────────────

function ScriptedLocalPlayer({
  localMoves,
  localBoardPlacements,
  localActorRef,
  onPlacementRejected,
}: {
  localMoves: ReadonlyArray<LocalMoveScript>;
  localBoardPlacements?: ReadonlyArray<BoardPlacement>;
  localActorRef: React.RefObject<LocalPlayerActor | null>;
  onPlacementRejected?: (message: string) => void;
}) {
  const { session } = useApp();
  const roundIndex = useRef(0);
  const placementAttemptIndex = useRef(0);
  const boardSeeded = useRef(false);
  const lastActionKey = useRef<string | null>(null);

  const round = session?.currentRound ?? null;
  const phase = round?.phase ?? "idle";
  const actorId = round?.currentActor?.id ?? "none";

  useEffect(() => {
    if (!session || !round) {
      return;
    }

    if (!boardSeeded.current) {
      const me = session.myPlayer();
      if (me && localBoardPlacements?.length) {
        localBoardPlacements.forEach((placement) => {
          me.board.place(placement.card, placement.x, placement.y, placement.direction);
        });
      }
      boardSeeded.current = true;
    }

    const actor = round.currentActor;
    if (!actor || actor.id !== session.myPlayer()?.id) {
      return;
    }

    const localActor = localActorRef.current;
    if (!localActor) return;

    const move = localMoves[roundIndex.current];
    if (!move) {
      throw new Error(`No scripted local move for round ${roundIndex.current + 1}`);
    }

    const actionKey =
      phase === ROUND_PHASE_PLACING
        ? `${roundIndex.current}:${phase}:${actor.id}:${placementAttemptIndex.current}`
        : `${roundIndex.current}:${phase}:${actor.id}`;
    if (lastActionKey.current === actionKey) {
      return;
    }
    lastActionKey.current = actionKey;

    queueMicrotask(() => {
      if (phase === ROUND_PHASE_PICKING) {
        let cardId: number;
        if (move.cardIndex !== undefined) {
          const available = (round.deal.snapshot() as ReadonlyArray<{ cardId: number; pickedBy: unknown }>)
            .filter((s) => s.pickedBy === null)
            .map((s) => s.cardId);
          const resolved = available[move.cardIndex];
          if (resolved === undefined) {
            throw new Error(`cardIndex ${move.cardIndex} out of range (${available.length} available)`);
          }
          cardId = resolved;
        } else if (move.card !== undefined) {
          cardId = move.card;
        } else {
          throw new Error(`No card or cardIndex for round ${roundIndex.current + 1}`);
        }
        localActor.resolvePick(cardId as CardId);
        return;
      }

      if (phase === ROUND_PHASE_PLACING) {
        if (move.discard === true) {
          localActor.resolvePlacement({ discard: true });
          roundIndex.current += 1;
          placementAttemptIndex.current = 0;
          return;
        }

        const placements =
          move.placements ??
          (move.x !== undefined && move.y !== undefined && move.direction !== undefined
            ? [{ x: move.x, y: move.y, direction: move.direction }]
            : []);

        const placementStep = placements[placementAttemptIndex.current];
        if (!placementStep) {
          throw new Error(
            `No scripted local placement attempt ${placementAttemptIndex.current + 1} for round ${roundIndex.current + 1}`,
          );
        }

        const placement =
          "mode" in placementStep
            ? (() => {
                const cardToPlace = session.localCardToPlace();
                if (cardToPlace === undefined) {
                  throw new Error("No local card available to place");
                }

                const board = session.myPlayer()?.board.snapshot();
                if (!board) {
                  throw new Error("No local board snapshot available");
                }

                if (placementStep.mode === "legal") {
                  const legalPlacement = findPlacementWithin5x5(board, cardToPlace);
                  if (!legalPlacement) {
                    throw new Error("No legal 5x5 placement available");
                  }
                  return legalPlacement;
                }

                const overflowPlacement = getEligiblePositions(board, cardToPlace)
                  .sort((a, b) => a.y - b.y || a.x - b.x)
                  .flatMap(({ x, y }) =>
                    getValidDirections(board, cardToPlace, x, y)
                      .slice()
                      .sort()
                      .map((direction) => ({ x, y, direction })),
                  )
                  .find(({ x, y, direction }) => !staysWithin5x5(board, x, y, direction));

                if (!overflowPlacement) {
                  throw new Error("No overflow placement candidate available");
                }

                return overflowPlacement;
              })()
            : placementStep;

        // Validate placement before resolving on the actor. If invalid, increment
        // attempt index and let the next render try the next scripted attempt.
        const cardToPlace = session.localCardToPlace();
        const board = session.myPlayer()?.board.snapshot();
        if (cardToPlace !== undefined && board) {
          const isEligible = getEligiblePositions(board, cardToPlace).some(
            (pos) => pos.x === placement.x && pos.y === placement.y,
          );
          const isValidDir = getValidDirections(board, cardToPlace, placement.x, placement.y)
            .includes(placement.direction);

          if (!isEligible || !isValidDir) {
            placementAttemptIndex.current += 1;
            onPlacementRejected?.(`place-rejected: invalid placement at (${placement.x},${placement.y}) ${placement.direction}`);
            return;
          }
        }

        localActor.resolvePlacement({ x: placement.x, y: placement.y, direction: placement.direction });
        roundIndex.current += 1;
        placementAttemptIndex.current = 0;
      }
    });
  }, [actorId, localActorRef, localBoardPlacements, localMoves, onPlacementRejected, phase, round, session]);

  return null;
}

// ── Story state panel ──────────────────────────────────────────────────────────

function StoryStatePanel({ scriptLog }: { scriptLog: ReadonlyArray<string> }) {
  const { hint, room, session } = useApp();
  const [eventLog, setEventLog] = useState<EventLogEntry[]>([]);

  useEffect(() => {
    setEventLog([]);

    if (!session) {
      return;
    }

    const append = (label: string, detail: string) => {
      setEventLog((current) => [...current, { label, detail }]);
    };

    const unsubscribers = [
      session.events.on(ROUND_STARTED, ({ round }) =>
        append(
          "round-started",
          round.deal
            .snapshot()
            .map((slot) => `#${slot.cardId}`)
            .join(", "),
        ),
      ),
      session.events.on(PICK_MADE, ({ player, cardId }) =>
        append("pick", `${player.id} -> #${cardId}`),
      ),
      session.events.on(PLACE_MADE, ({ player, cardId, x, y, direction }) =>
        append("place", `${player.id} -> #${cardId} @ (${x},${y}) ${direction}`),
      ),
      session.events.on(DISCARD_MADE, ({ player, cardId }) =>
        append("discard", `${player.id} -> #${cardId}`),
      ),
      session.events.on(ROUND_COMPLETE, ({ nextPickOrder }) =>
        append("round-complete", nextPickOrder.map((player) => player.id).join(" -> ")),
      ),
      session.events.on(GAME_ENDED, ({ scores }) =>
        append("game-ended", scores.map(({ player, score }) => `${player.id}:${score}`).join(", ")),
      ),
    ];

    return () => {
      unsubscribers.forEach((unsubscribe) => unsubscribe());
    };
  }, [session]);

  const dealIds = session?.deal().map((card) => card.id) ?? [];
  const currentActor = session?.currentRound?.currentActor?.id ?? "none";
  const roundPhase = session?.currentRound?.phase ?? "none";

  return (
    <section
      aria-label="Real game visual test summary"
      style={{ marginTop: 16, padding: 16, border: "1px solid #777", borderRadius: 8 }}
    >
      <h2>Real game visual test summary</h2>
      <p>Room: {room}</p>
      <p>Hint: {hint}</p>
      <p>Phase: {session?.phase ?? "none"}</p>
      <p>Round phase: {roundPhase}</p>
      <p>Current actor: {currentActor}</p>
      <p>Deal ids: {dealIds.length ? dealIds.join(", ") : "none"}</p>
      <p>Pick order: {session?.pickOrder.map((player) => player.id).join(" -> ") ?? "none"}</p>
      <table aria-label="Player summary">
        <thead>
          <tr>
            <th scope="col">Player</th>
            <th scope="col">Local</th>
            <th scope="col">Placements</th>
            <th scope="col">Score</th>
          </tr>
        </thead>
        <tbody>
          {session?.players.map((player) => (
            <tr key={player.id}>
              <th scope="row">{player.id}</th>
              <td>{player.id === session?.myPlayer()?.id ? "yes" : "no"}</td>
              <td>{player.board.placements.length}</td>
              <td>{player.score()}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <ol aria-label="Event log">
        {eventLog.map((entry, index) => (
          <li key={`${entry.label}-${index}`}>
            {entry.label}: {entry.detail}
          </li>
        ))}
        {scriptLog.map((entry, index) => (
          <li key={`script-${index}`}>{entry}</li>
        ))}
      </ol>
    </section>
  );
}

// ── Main harness ───────────────────────────────────────────────────────────────

export function RealGameRuleHarness({ scenario }: { scenario: RealGameScenario }) {
  const [scriptLog, setScriptLog] = useState<string[]>([]);
  const localActorRef = useRef<LocalPlayerActor | null>(null);

  const storyFactory = useMemo(() => new StoryRosterFactory(scenario), [scenario]);

  const flow = useMemo(() => {
    return new LobbyFlow({
      adapter: new AppFlowAdapter(),
      rosterFactory: {
        async build(config: RosterConfig) {
          const result = await storyFactory.build(config);
          localActorRef.current = storyFactory.localActor;
          return result;
        },
      },
      variant: scenario.variant,
      bonuses: scenario.bonuses,
    });
  }, [storyFactory, scenario.variant, scenario.bonuses]);

  useEffect(() => {
    resetAppState();
    setScriptLog([]);

    flow.start();

    if (scenario.autoStart !== false) {
      const defaultConfig: RosterConfig = [{ type: SLOT_LOCAL }, { type: SLOT_AI }];
      queueMicrotask(() => triggerLobbyStart(defaultConfig));
    }

    return () => {
      localActorRef.current = null;
      triggerLobbyLeave();
      resetAppState();
      setScriptLog([]);
    };
  }, [flow, scenario]);

  return (
    <>
      <App />
      <ScriptedLocalPlayer
        localBoardPlacements={scenario.localBoardPlacements}
        localMoves={scenario.localMoves}
        localActorRef={localActorRef}
        onPlacementRejected={(message) => setScriptLog((current) => [...current, message])}
      />
      <StoryStatePanel scriptLog={scriptLog} />
    </>
  );
}

export function RuleScenarioScaffold({
  title,
  ruleFocus,
  given,
  when,
  expectedOutcome,
}: RuleScenarioProps) {
  return (
    <section style={{ marginTop: 16, padding: 16, border: "1px dashed #777", borderRadius: 8 }}>
      <h2>{title}</h2>
      <p>
        <strong>Rule focus:</strong> {ruleFocus}
      </p>
      <p>
        <strong>Given:</strong> {given}
      </p>
      <p>
        <strong>When:</strong> {when}
      </p>
      <p>
        <strong>Expected outcome:</strong> {expectedOutcome}
      </p>
      <p>Pending conversion to the real-flow story harness.</p>
    </section>
  );
}
