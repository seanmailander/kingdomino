import type { Meta, StoryObj } from "@storybook/react-vite";

import { RuleScenarioScaffold } from "./GameRulesVisualTdd.shared";

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
  play: async () => {
    // TODO: Assert per-property score rows and total prestige points.
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
    // TODO: Assert tie-break explanation and winner selection.
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
    // TODO: Assert optional variant bonus rows and totals.
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
    // TODO: Assert per-round totals and final aggregate ranking.
  },
};
