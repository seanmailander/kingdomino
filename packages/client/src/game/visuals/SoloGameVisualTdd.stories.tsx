import React from "react";
import type { Meta, StoryObj } from "@storybook/react-vite";
import { action } from "storybook/actions";
import { expect, userEvent, spyOn } from "storybook/test";

import { App } from "../../App/App";
import { GameStoreProvider } from "../../App/GameStoreContext";

const meta = {
  title: "Game/Solo AI Visual TDD",
  component: App,
  args: {
    seed: "test-seed-12345",
  },
  tags: ["autodocs"],
  decorators: [
    (Story) => (
      <GameStoreProvider>
        <Story />
      </GameStoreProvider>
    ),
  ],
} satisfies Meta<typeof App>;

export default meta;
type Story = StoryObj<typeof meta>;

async function startSoloGame(
  canvas: Parameters<NonNullable<Story["play"]>>[0]["canvas"],
) {
  await userEvent.click(canvas.getByRole("button", { name: /start solo/i }));
  await userEvent.click(await canvas.findByRole("button", { name: /start game/i }));
}

async function driveGameToEnd(
  canvas: Parameters<NonNullable<Story["play"]>>[0]["canvas"],
  timeout: number,
) {
  // Drive the game turn-by-turn using only rendered UI locators.
  // Each await yields control so React can re-render between actions,
  // preventing the double-click race where waitFor retries a stale DOM.
  // orientationStep tracks how many times we've tried to change orientation:
  //   0-3: rotate (4 directions), 4: flip, 5-8: rotate again (back through all 4)
  let orientationStep = 0;
  const deadline = Date.now() + timeout;
  while (Date.now() < deadline) {
    if (canvas.queryByTestId("game-over")) break;

    const card = canvas.queryAllByTestId("available-card")[0];
    if (card) {
      orientationStep = 0;
      await userEvent.click(card);
      // Yield to let React flush the pick re-render before next iteration
      await new Promise((r) => setTimeout(r, 0));
      continue;
    }

    const tile = canvas.queryAllByTestId("valid-placement")[0];
    if (tile) {
      orientationStep = 0;
      await userEvent.click(tile);
      await new Promise((r) => setTimeout(r, 0));
      continue;
    }

    // No valid placement with current orientation — try rotating (4 directions) then flipping then rotating again
    if (orientationStep < 4) {
      orientationStep++;
      const rotateBtn = canvas.queryAllByRole("button", { name: /rotate card/i })[0];
      if (rotateBtn) {
        await userEvent.click(rotateBtn);
        await new Promise((r) => setTimeout(r, 0));
        continue;
      }
    } else if (orientationStep === 4) {
      orientationStep++;
      const flipBtn = canvas.queryAllByRole("button", { name: /flip card/i })[0];
      if (flipBtn) {
        await userEvent.click(flipBtn);
        await new Promise((r) => setTimeout(r, 0));
        continue;
      }
    } else if (orientationStep < 9) {
      orientationStep++;
      const rotateBtn = canvas.queryAllByRole("button", { name: /rotate card/i })[0];
      if (rotateBtn) {
        await userEvent.click(rotateBtn);
        await new Promise((r) => setTimeout(r, 0));
        continue;
      }
    }

    // All 8 orientations tried with no valid placement — discard if possible, otherwise poll.
    const discardBtn = canvas.queryByRole("button", { name: /discard card/i });
    if (discardBtn) {
      orientationStep = 0;
      await userEvent.click(discardBtn);
      await new Promise((r) => setTimeout(r, 0));
      continue;
    }

    // AI is processing. Poll every 100ms.
    await new Promise((r) => setTimeout(r, 100));
  }

  await expect(canvas.getByTestId("game-over")).toBeVisible();
}

async function playSoloGameToEnd(
  canvas: Parameters<NonNullable<Story["play"]>>[0]["canvas"],
  timeout: number,
) {
  await startSoloGame(canvas);
  await driveGameToEnd(canvas, timeout);
}

export const SoloGamePlaysToCompletion: Story = {
  play: async ({ canvas }) => {
    await playSoloGameToEnd(canvas, 85000);
  },
};

// Snapshot stories: each runs to a key moment and stops so storybook-addon-vis
// can capture a stable baseline via the "snapshot" tag.

export const PickPhase: Story = {
  tags: ["snapshot"],
  play: async ({ canvas }) => {
    await startSoloGame(canvas);
    await canvas.findAllByTestId("available-card");
  },
};

export const PlacementPhase: Story = {
  tags: ["snapshot"],
  play: async ({ canvas }) => {
    await startSoloGame(canvas);
    await canvas.findAllByTestId("available-card");
    await userEvent.click(canvas.queryAllByTestId("available-card")[0]);
    await canvas.findAllByTestId("valid-placement");
  },
};

export const GameOver: Story = {
  play: async ({ canvas }) => {
    await playSoloGameToEnd(canvas, 85000);
  },
};
