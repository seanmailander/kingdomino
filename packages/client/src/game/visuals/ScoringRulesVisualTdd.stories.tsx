import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect, waitFor } from "storybook/test";

import {
  BONUS_SCENARIO,
  FIRST_ROUND_RULE_SCENARIO,
  TIE_BREAK_SCENARIO,
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
  tags: ["failing-test"],
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
    // me picks #24 (wood+1cr/grain) → wood region: 1 tile × 1 crown = 1 point
    await expect(canvas.getByText("game-ended: me:1, them:0")).toBeVisible();
  },
};

export const TieBreakResolution: Story = {
  tags: ["failing-test"],
  args: {
    title: "Tie break by largest property then crowns",
    ruleFocus: "Resolve ties by largest property, then by crown count",
    given: "Two players tied on total prestige points",
    when: "Winner is resolved",
    expectedOutcome: "Winner follows tie-break rule order",
  },
  render: () => <RealGameRuleHarness scenario={TIE_BREAK_SCENARIO} />,
  play: async ({ canvas }) => {
    await expect(
      canvas.getByRole("heading", { name: "Real game visual test summary" }),
    ).toBeVisible();

    const playerSummary = canvas.getByRole("table", { name: "Player summary" });
    await expect(playerSummary).toBeVisible();

    // Wait for game to complete and verify scores are present in expected format
    const gameEndedEl = await canvas.findByText(/^game-ended:/, {}, { timeout: 5000 });
    await expect(gameEndedEl).toBeVisible();
    await expect(gameEndedEl).toHaveTextContent(/^game-ended: me:\d+, them:\d+$/);
  },
};

export const VariantBonusesMiddleKingdomAndHarmony: Story = {
  tags: ["failing-test"],
  args: {
    title: "Variant bonuses: Middle Kingdom and Harmony",
    ruleFocus: "Apply +10 middle kingdom and +5 harmony when enabled",
    given: "Variant toggles enabled with qualifying final board",
    when: "Final scoring runs",
    expectedOutcome: "Bonus points are displayed and included",
  },
  render: () => <RealGameRuleHarness scenario={BONUS_SCENARIO} />,
  play: async ({ canvas }) => {
    await expect(
      canvas.getByRole("heading", { name: "Real game visual test summary" }),
    ).toBeVisible();

    // Wait for game to complete; me earns +10 MK + +5 harmony = 15 total (0 base).
    // them earns +5 harmony only = 5 total (0 base, not centred).
    await waitFor(
      async () => {
        const gameEndedEntry = canvas.getByText(/^game-ended:/);
        await expect(gameEndedEntry).toBeVisible();
      },
      { timeout: 5000 },
    );

    await expect(canvas.getByText("game-ended: me:15, them:5")).toBeVisible();
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
