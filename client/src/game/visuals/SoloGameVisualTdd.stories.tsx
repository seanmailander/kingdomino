import React, { useEffect, useMemo, useState } from "react";
import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect, waitFor } from "storybook/test";

import { App } from "../../App/App";
import { resetAppState, triggerLobbyStart, useApp } from "../../App/store";
import { findPlacementWithin5x5 } from "../gamelogic/board";
import { LobbyFlow } from "../state/game.flow";
import type { GameSession } from "../state/GameSession";

/**
 * Auto-drives the local ("me") player when it is their turn.
 *
 * Uses setTimeout(0) to defer placement until LobbyFlow has registered its
 * place:made listener (avoids a race between the LocalAutoDriver's pick:made
 * handler and LobbyFlow's async loop registering the next waitForEvent).
 */
function LocalAutoDriver({ session }: { session: GameSession | null }) {
  useEffect(() => {
    if (!session) return;

    const autoPick = () => {
      if (!session.isMyTurn()) return;
      const snap = session.currentRound?.deal.snapshot();
      const first = snap?.find((s) => s.pickedBy === null);
      if (first) session.handleLocalPick(first.cardId);
    };

    const autoPlace = () => {
      if (!session.isMyPlace()) return;
      const cardId = session.localCardToPlace();
      if (cardId == null) return;
      const playerId = session.myPlayer()?.id;
      if (playerId == null) return;
      const board = session.boardFor(playerId);
      const p = findPlacementWithin5x5(board, cardId);
      if (p) session.handleLocalPlacement(p.x, p.y, p.direction);
    };

    const offRound = session.events.on("round:started", autoPick);
    const offPick = session.events.on("pick:made", () => {
      // Defer both to let LobbyFlow's async loop register its next listener first
      setTimeout(autoPlace, 0);
      setTimeout(autoPick, 0);
    });

    return () => {
      offRound();
      offPick();
    };
  }, [session]);

  return null;
}

function SoloGameHarness({ roundLimit }: { roundLimit: number }) {
  const { session } = useApp();
  const [gameEnded, setGameEnded] = useState(false);

  const flow = useMemo(
    () =>
      new LobbyFlow({
        shouldContinuePlaying: (completedRounds) => completedRounds < roundLimit,
      }),
    [roundLimit],
  );

  useEffect(() => {
    resetAppState();
    flow.ReadySolo();
    triggerLobbyStart();
  }, [flow]);

  useEffect(() => {
    if (!session) return;
    return session.events.on("game:ended", () => setGameEnded(true));
  }, [session]);

  return (
    <>
      <App />
      <LocalAutoDriver session={session} />
      {gameEnded && <p data-testid="game-ended-indicator">Solo game complete</p>}
    </>
  );
}

const meta = {
  title: "Game/Solo AI Visual TDD",
  component: SoloGameHarness,
  tags: ["autodocs"],
} satisfies Meta<typeof SoloGameHarness>;

export default meta;
type Story = StoryObj<typeof meta>;

export const SoloGameCompletesOneRound: Story = {
  args: { roundLimit: 1 },
  play: async ({ canvas }) => {
    await waitFor(
      async () => {
        await expect(canvas.getByTestId("game-ended-indicator")).toBeVisible();
      },
      { timeout: 15000 },
    );
    await expect(canvas.getByText(/Kingdomino/i)).toBeVisible();
  },
};

export const SoloGameCompletesTwoRounds: Story = {
  args: { roundLimit: 2 },
  play: async ({ canvas }) => {
    await waitFor(
      async () => {
        await expect(canvas.getByTestId("game-ended-indicator")).toBeVisible();
      },
      { timeout: 30000 },
    );
    await expect(canvas.getByText(/Kingdomino/i)).toBeVisible();
  },
};
