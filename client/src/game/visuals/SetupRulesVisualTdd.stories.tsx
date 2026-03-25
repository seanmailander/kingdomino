import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect } from "storybook/test";

import { RuleScenarioScaffold, SetupByPlayerCountHarness } from "./GameRulesVisualTdd.shared";

const meta = {
  title: "Game/Rules Visual TDD/Setup",
  component: RuleScenarioScaffold,
  tags: ["autodocs"],
} satisfies Meta<typeof RuleScenarioScaffold>;

export default meta;
type Story = StoryObj<typeof meta>;

export const SetupByPlayerCount: Story = {
  args: {
    title: "Setup by player count",
    ruleFocus: "2p uses 24 dominoes, 3p uses 36, 4p uses 48; kings in play define line size",
    given: "A new game with selected player count",
    when: "Initial draw line is created",
    expectedOutcome: "Line length and available domino pool match rules",
  },
  render: () => <SetupByPlayerCountHarness />,
  play: async ({ canvas }) => {
    await expect(canvas.getByRole("heading", { name: "Setup by player count" })).toBeVisible();
    const table = canvas.getByRole("table", { name: "Kingdomino setup rules by player count" });

    await expect(table).toBeVisible();
    await expect(canvas.getByRole("rowheader", { name: "2 players" })).toBeVisible();
    await expect(canvas.getByRole("rowheader", { name: "3 players" })).toBeVisible();
    await expect(canvas.getByRole("rowheader", { name: "4 players" })).toBeVisible();
    await expect(table).toHaveTextContent("24");
    await expect(table).toHaveTextContent("36");
    await expect(table).toHaveTextContent("48");
    await expect(table).toHaveTextContent("6");
    await expect(table).toHaveTextContent("12");
  },
};

export const MightyDuelUsesSevenBySevenGrid: Story = {
  args: {
    title: "Mighty Duel uses 7x7 grid in 2-player game",
    ruleFocus: "Mighty Duel variant expands kingdom size to 7x7 with full domino set",
    given: "Two-player game with Mighty Duel enabled",
    when: "Board is initialized and placement begins",
    expectedOutcome: "Board boundary and available dominoes reflect variant rules",
  },
  play: async () => {
    // TODO: Assert 7x7 bounds and variant setup indicators.
  },
};
