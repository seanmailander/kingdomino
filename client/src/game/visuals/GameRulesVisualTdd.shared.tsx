import React, { useEffect, useMemo, useRef, useState } from "react";

import { App } from "../../App/App";
import { resetAppState, triggerLobbyLeave, triggerLobbyStart, useApp } from "../../App/store";
import { hashIt } from "../gamelogic/utils";
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
  x: number;
  y: number;
  direction: Direction;
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

function ScriptedLocalPlayer({ localMoves }: { localMoves: ReadonlyArray<LocalMoveScript> }) {
  const { session } = useApp();
  const roundIndex = useRef(0);
  const lastActionKey = useRef<string | null>(null);

  const round = session?.currentRound ?? null;
  const phase = round?.phase ?? "idle";
  const actorId = round?.currentActor?.id ?? "none";

  useEffect(() => {
    if (!session || !round) {
      return;
    }

    const actor = round.currentActor;
    if (!actor?.isLocal) {
      return;
    }

    const move = localMoves[roundIndex.current];
    if (!move) {
      throw new Error(`No scripted local move for round ${roundIndex.current + 1}`);
    }

    const actionKey = `${roundIndex.current}:${phase}:${actor.id}`;
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
        session.handleLocalPlacement(move.x, move.y, move.direction);
        roundIndex.current += 1;
      }
    });
  }, [actorId, localMoves, phase, round, session]);

  return null;
}

function StoryStatePanel() {
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
      </ol>
    </section>
  );
}

export function RealGameRuleHarness({ scenario }: RealGameRuleHarnessProps) {
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
    };
  }, [flow, scenario]);

  return (
    <>
      <App />
      <ScriptedLocalPlayer localMoves={scenario.localMoves} />
      <StoryStatePanel />
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
