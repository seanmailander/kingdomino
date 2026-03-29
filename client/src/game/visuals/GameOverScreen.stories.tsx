import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect, fn } from "storybook/test";
import { Player } from "kingdomino-engine";
import { right } from "kingdomino-engine";
import { GameOverScreen } from "./GameOverScreen";
import type { ScoreEntry } from "./GameOverScreen";

const meta = {
  title: "Game/GameOverScreen",
  component: GameOverScreen,
  tags: ["autodocs"],
  args: {
    onReturnToLobby: fn(),
  },
} satisfies Meta<typeof GameOverScreen>;

export default meta;
type Story = StoryObj<typeof meta>;

// ── Fixtures ──────────────────────────────────────────────────────────────────

function makePlayer(id: string): Player {
  return new Player(id);
}

function twoPlayerNoBonuses(): ScoreEntry[] {
  return [
    {
      player: makePlayer("Alice"),
      score: 18,
      bonuses: { middleKingdom: 0, harmony: 0 },
      isWinner: true,
    },
    {
      player: makePlayer("Bob"),
      score: 9,
      bonuses: { middleKingdom: 0, harmony: 0 },
      isWinner: false,
    },
  ];
}

function withBonuses(): ScoreEntry[] {
  return [
    {
      player: makePlayer("Alice"),
      score: 33,
      bonuses: { middleKingdom: 10, harmony: 5 },
      isWinner: true,
    },
    {
      player: makePlayer("Bob"),
      score: 21,
      bonuses: { middleKingdom: 0, harmony: 0 },
      isWinner: false,
    },
  ];
}

function twoPlayerTie(): ScoreEntry[] {
  return [
    {
      player: makePlayer("Alice"),
      score: 12,
      bonuses: { middleKingdom: 0, harmony: 0 },
      isWinner: true,
    },
    {
      player: makePlayer("Bob"),
      score: 12,
      bonuses: { middleKingdom: 0, harmony: 0 },
      isWinner: true,
    },
  ];
}

// ── Stories ───────────────────────────────────────────────────────────────────

export const TwoPlayerNoBonuses: Story = {
  args: { scores: twoPlayerNoBonuses() },
  play: async ({ canvas }) => {
    await expect(canvas.getByRole("heading", { name: "Game over" })).toBeVisible();

    // Winner is highlighted
    const winnerEntry = canvas.getByRole("listitem", { name: /Alice.*winner/i });
    await expect(winnerEntry).toBeVisible();

    // Loser entry exists
    const loserEntry = canvas.getByRole("listitem", { name: /Bob/i });
    await expect(loserEntry).toBeVisible();

    // Scores are shown
    await expect(canvas.getAllByText("18")[0]).toBeVisible();
    await expect(canvas.getAllByText("9")[0]).toBeVisible();

    // No bonus rows
    await expect(canvas.queryByText("Middle Kingdom")).toBeNull();
    await expect(canvas.queryByText("Harmony")).toBeNull();

    // Return button
    await expect(canvas.getByRole("button", { name: "Return to Lobby" })).toBeVisible();
  },
};

export const WithBonuses: Story = {
  args: { scores: withBonuses() },
  play: async ({ canvas }) => {
    await expect(canvas.getByRole("heading", { name: "Game over" })).toBeVisible();

    // Winner shown with total 33
    const winnerEntry = canvas.getByRole("listitem", { name: /Alice.*winner/i });
    await expect(winnerEntry).toBeVisible();

    // Bonus rows are shown for Alice
    await expect(canvas.getByText("Middle Kingdom")).toBeVisible();
    await expect(canvas.getAllByText(/\+10/)[0]).toBeVisible();
    await expect(canvas.getByText("Harmony")).toBeVisible();
    await expect(canvas.getAllByText(/\+5/)[0]).toBeVisible();

    // Base score for Alice = 33 - 10 - 5 = 18
    await expect(canvas.getAllByText("18")[0]).toBeVisible();

    // Bob has no bonus rows in his entry (Bob score 21, no bonuses)
    await expect(canvas.getAllByText("21")[0]).toBeVisible();

    await expect(canvas.getByRole("button", { name: "Return to Lobby" })).toBeVisible();
  },
};

export const TwoPlayerTie: Story = {
  args: { scores: twoPlayerTie() },
  play: async ({ canvas }) => {
    await expect(canvas.getByRole("heading", { name: "Game over" })).toBeVisible();

    // Both players are marked as winners
    const aliceEntry = canvas.getByRole("listitem", { name: /Alice.*winner/i });
    const bobEntry = canvas.getByRole("listitem", { name: /Bob.*winner/i });
    await expect(aliceEntry).toBeVisible();
    await expect(bobEntry).toBeVisible();

    // Both show score 12
    const twelves = canvas.getAllByText("12");
    await expect(twelves.length).toBeGreaterThanOrEqual(2);

    await expect(canvas.getByRole("button", { name: "Return to Lobby" })).toBeVisible();
  },
};

export const ReturnToLobbyCallback: Story = {
  args: { scores: twoPlayerNoBonuses() },
  play: async ({ canvas, args }) => {
    const btn = canvas.getByRole("button", { name: "Return to Lobby" });
    await btn.click();
    await expect(args.onReturnToLobby).toHaveBeenCalledOnce();
  },
};
