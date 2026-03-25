import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect } from "storybook/test";

import {
  FIRST_ROUND_RULE_SCENARIO,
  RealGameRuleHarness,
  RuleScenarioScaffold,
} from "./GameRulesVisualTdd.shared";

const meta = {
  title: "Game/Rules Visual TDD/Scoring",
  component: RuleScenarioScaffold,
  tags: ["autodocs"],
} satisfies Meta<typeof RuleScenarioScaffold>;

export default meta;
type Story = StoryObj<typeof meta>;

export const PrestigeScoringByProperty: Story = {
  args: {
    title: "Property scoring equals area x crowns",
    ruleFocus: "Connected same-terrain regions score tiles multiplied by crowns",
    given: "A completed kingdom with multiple terrain properties",
    when: "Scoring summary is shown",
    expectedOutcome: "Each property and total score match rules",
  },
  render: () => <RealGameRuleHarness scenario={FIRST_ROUND_RULE_SCENARIO} />,
  play: async ({ canvas }) => {
    await expect(
      canvas.getByRole("heading", { name: "Real game visual test summary" }),
    ).toBeVisible();

    const playerSummary = canvas.getByRole("table", { name: "Player summary" });
    await expect(playerSummary).toBeVisible();
    await expect(canvas.getByRole("rowheader", { name: "me" })).toBeVisible();
    await expect(canvas.getByRole("rowheader", { name: "them" })).toBeVisible();
    await expect(playerSummary).toHaveTextContent("me");
    await expect(playerSummary).toHaveTextContent("2");
    await expect(playerSummary).toHaveTextContent("them");
    await expect(playerSummary).toHaveTextContent("0");
    await expect(canvas.getByText("game-ended: me:2, them:0")).toBeVisible();
  },
};

export const TieBreakResolution: Story = {
  args: {
    title: "Tie break by largest property then crowns",
    ruleFocus: "Resolve ties by largest property, then by crown count",
    given: "Two players tied on total prestige points",
    when: "Winner is resolved",
    expectedOutcome: "Winner follows tie-break rule order",
  },
  play: async () => {
    // TODO(blocked by missing runtime feature): convert after docs/superpowers/plans/2026-03-25-missing-game-features-next-steps.md is implemented.
  },
};

export const VariantBonusesMiddleKingdomAndHarmony: Story = {
  args: {
    title: "Variant bonuses: Middle Kingdom and Harmony",
    ruleFocus: "Apply +10 middle kingdom and +5 harmony when enabled",
    given: "Variant toggles enabled with qualifying final board",
    when: "Final scoring runs",
    expectedOutcome: "Bonus points are displayed and included",
  },
  play: async () => {
    // TODO(blocked by missing runtime feature): convert after docs/superpowers/plans/2026-03-25-missing-game-features-next-steps.md is implemented.
  },
};

export const DynastyThreeRoundAggregate: Story = {
  args: {
    title: "Dynasty mode aggregates 3 rounds",
    ruleFocus: "Dynasty winner is based on total score across 3 consecutive rounds",
    given: "Dynasty mode enabled with three completed round scores",
    when: "Series results are displayed",
    expectedOutcome: "Aggregate totals determine the winner",
  },
  play: async () => {
    // TODO(blocked by missing runtime feature): convert after docs/superpowers/plans/2026-03-25-missing-game-features-next-steps.md is implemented.
  },
};
