import React, { useEffect, useMemo, useRef, useState } from "react";

import { App } from "../../App/App";
import { resetAppState, triggerLobbyLeave, triggerLobbyStart, useApp } from "../../App/store";
import {
  findPlacementWithin5x5,
  getEligiblePositions,
  getValidDirections,
  staysWithin5x5,
} from "../gamelogic/board";
import { hashIt } from "../gamelogic/utils";
import type { BoardPlacement } from "../state/Board";
import { ConnectionManager } from "../state/ConnectionManager";
import { LobbyFlow } from "../state/game.flow";
import { TestConnection, type TestConnectionScenario } from "../state/connection.testing";
import type { Direction } from "../state/types";

type HandshakeScript = {
  localSecret: number;
  remoteSecret: number;
  remoteCommittment?: string;
};

type LocalMoveScript = {
  card: number;
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
  localBoardPlacements?: ReadonlyArray<BoardPlacement>;
  handshakes: ReadonlyArray<HandshakeScript>;
  localMoves: ReadonlyArray<LocalMoveScript>;
  remoteMoves: TestConnectionScenario["moves"];
};

export const FIRST_ROUND_RULE_SCENARIO: RealGameScenario = {
  roundLimit: 1,
  handshakes: [
    { localSecret: 11, remoteSecret: 101 },
    { localSecret: 22, remoteSecret: 202 },
  ],
  localMoves: [{ card: 46, x: 6, y: 5, direction: "up" }],
  remoteMoves: [{ card: 4, x: 6, y: 5, direction: "up" }],
};

export const PLACEMENT_CONNECT_LEGALITY_SCENARIO: RealGameScenario = {
  roundLimit: 1,
  handshakes: [
    { localSecret: 11, remoteSecret: 101 },
    { localSecret: 22, remoteSecret: 202 },
  ],
  localMoves: [
    {
      card: 46,
      placements: [
        { x: 0, y: 0, direction: "right" },
        { x: 6, y: 5, direction: "up" },
      ],
    },
  ],
  remoteMoves: [{ card: 4, x: 6, y: 5, direction: "up" }],
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
  localMoves: [{ card: 46, placements: [{ mode: "overflow" }, { mode: "legal" }] }],
  remoteMoves: [{ card: 4, x: 6, y: 5, direction: "up" }],
};

type RealGameRuleHarnessProps = {
  scenario: RealGameScenario;
};

export type RuleScenarioProps = {
  title: string;
  ruleFocus: string;
  given: string;
  when: string;
  expectedOutcome: string;
};

const buildCommitSequence = (handshakes: ReadonlyArray<HandshakeScript>) => {
  let index = 0;

  return async () => {
    const handshake = handshakes[index];
    if (!handshake) {
      throw new Error(`No scripted local handshake for exchange ${index + 1}`);
    }

    index += 1;

    return {
      secret: handshake.localSecret,
      committment: await hashIt(handshake.localSecret),
    };
  };
};

function ScriptedLocalPlayer({
  localMoves,
  localBoardPlacements,
  onPlacementRejected,
}: {
  localMoves: ReadonlyArray<LocalMoveScript>;
  localBoardPlacements?: ReadonlyArray<BoardPlacement>;
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
    if (!actor?.isLocal) {
      return;
    }

    const move = localMoves[roundIndex.current];
    if (!move) {
      throw new Error(`No scripted local move for round ${roundIndex.current + 1}`);
    }

    const actionKey =
      phase === "placing"
        ? `${roundIndex.current}:${phase}:${actor.id}:${placementAttemptIndex.current}`
        : `${roundIndex.current}:${phase}:${actor.id}`;
    if (lastActionKey.current === actionKey) {
      return;
    }
    lastActionKey.current = actionKey;

    queueMicrotask(() => {
      if (phase === "picking") {
        session.handleLocalPick(move.card);
        return;
      }

      if (phase === "placing") {
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

        try {
          session.handleLocalPlacement(placement.x, placement.y, placement.direction);
          roundIndex.current += 1;
          placementAttemptIndex.current = 0;
        } catch (error) {
          const reason = error instanceof Error ? error.message : String(error);
          // Keep trying scripted attempts for the same round until one succeeds.
          placementAttemptIndex.current += 1;
          onPlacementRejected?.(`place-rejected: ${reason}`);
        }
      }
    });
  }, [actorId, localBoardPlacements, localMoves, onPlacementRejected, phase, round, session]);

  return null;
}

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
      session.events.on("round:started", ({ round }) =>
        append(
          "round-started",
          round.deal
            .snapshot()
            .map((slot) => `#${slot.cardId}`)
            .join(", "),
        ),
      ),
      session.events.on("pick:made", ({ player, cardId }) =>
        append("pick", `${player.id} -> #${cardId}`),
      ),
      session.events.on("place:made", ({ player, cardId, x, y, direction }) =>
        append("place", `${player.id} -> #${cardId} @ (${x},${y}) ${direction}`),
      ),
      session.events.on("round:complete", ({ nextPickOrder }) =>
        append("round-complete", nextPickOrder.map((player) => player.id).join(" -> ")),
      ),
      session.events.on("game:ended", ({ scores }) =>
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
              <td>{player.isLocal ? "yes" : "no"}</td>
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

export function RealGameRuleHarness({ scenario }: RealGameRuleHarnessProps) {
  const [scriptLog, setScriptLog] = useState<string[]>([]);

  const flow = useMemo(() => {
    const commit = buildCommitSequence(scenario.handshakes);
    return new LobbyFlow({
      createConnectionManager: (connection) =>
        new ConnectionManager(connection.send, connection.waitFor, { commit }),
      shouldContinuePlaying: (completedRounds) =>
        scenario.roundLimit === undefined || completedRounds < scenario.roundLimit,
    });
  }, [scenario.handshakes, scenario.roundLimit]);

  useEffect(() => {
    resetAppState();
    setScriptLog([]);

    const connection = new TestConnection({
      me: scenario.me,
      them: scenario.them,
      scenario: {
        handshakes: scenario.handshakes.map(({ remoteSecret, remoteCommittment }) => ({
          secret: remoteSecret,
          committment: remoteCommittment,
        })),
        moves: scenario.remoteMoves,
      },
    });

    flow.ready(connection);

    if (scenario.autoStart !== false) {
      queueMicrotask(() => triggerLobbyStart());
    }

    return () => {
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
