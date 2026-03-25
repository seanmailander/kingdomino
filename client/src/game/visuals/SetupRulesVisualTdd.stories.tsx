import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect } from "storybook/test";

import {
  FIRST_ROUND_RULE_SCENARIO,
  RealGameRuleHarness,
  RuleScenarioScaffold,
} from "./GameRulesVisualTdd.shared";

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
  render: () => <RealGameRuleHarness scenario={FIRST_ROUND_RULE_SCENARIO} />,
  play: async ({ canvas }) => {
    await expect(
      canvas.getByRole("heading", { name: "Real game visual test summary" }),
    ).toBeVisible();
    await expect(canvas.getByText("round-started: #4, #22, #28, #46")).toBeVisible();
    await expect(canvas.getByRole("rowheader", { name: "me" })).toBeVisible();
    await expect(canvas.getByRole("rowheader", { name: "them" })).toBeVisible();
    await expect(canvas.getByText("Room: Game")).toBeVisible();
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
