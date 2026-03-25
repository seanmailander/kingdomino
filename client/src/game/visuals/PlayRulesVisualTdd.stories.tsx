import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect } from "storybook/test";

import {
  DISCARD_WHEN_UNPLACEABLE_SCENARIO,
  FIRST_ROUND_RULE_SCENARIO,
  GRID_BOUNDARY_RULE_SCENARIO,
  PLACEMENT_CONNECT_LEGALITY_SCENARIO,
  RealGameRuleHarness,
  RuleScenarioScaffold,
} from "./GameRulesVisualTdd.shared";

const meta = {
  title: "Game/Rules Visual TDD/Play",
  component: RuleScenarioScaffold,
  tags: ["autodocs"],
} satisfies Meta<typeof RuleScenarioScaffold>;

export default meta;
type Story = StoryObj<typeof meta>;

export const TurnOrderFromDominoSelection: Story = {
  args: {
    title: "Turn order from chosen domino positions",
    ruleFocus: "Play order follows ascending domino number in current line",
    given: "Kings placed on a sorted line",
    when: "Turn begins",
    expectedOutcome: "Players act in king order from first domino to last",
  },
  render: () => <RealGameRuleHarness scenario={FIRST_ROUND_RULE_SCENARIO} />,
  play: async ({ canvas }) => {
    await expect(
      canvas.getByRole("heading", { name: "Real game visual test summary" }),
    ).toBeVisible();
    await expect(canvas.getByText("pick: them -> #4")).toBeVisible();
    await expect(canvas.getByText("pick: me -> #46")).toBeVisible();
    await expect(canvas.getByText("round-complete: them -> me")).toBeVisible();
    await expect(canvas.getByText("Pick order: them -> me")).toBeVisible();
    await expect(canvas.getByRole("rowheader", { name: "me" })).toBeVisible();
    await expect(canvas.getByRole("rowheader", { name: "them" })).toBeVisible();
  },
};

export const PlacementMustConnectLegally: Story = {
  // In scope for docs/superpowers/plans/2026-03-25-supported-story-conversion-next-steps.md.
  args: {
    title: "Placement must connect to castle or matching terrain",
    ruleFocus: "Domino placement requires valid orthogonal connection",
    given: "A board with castle and existing terrain regions",
    when: "A player attempts legal and illegal placements",
    expectedOutcome: "Only legal placements are accepted",
  },
  render: () => <RealGameRuleHarness scenario={PLACEMENT_CONNECT_LEGALITY_SCENARIO} />,
  play: async ({ canvas }) => {
    await expect(await canvas.findByText(/place-rejected:/i)).toBeVisible();
    await expect(await canvas.findByText("place: me -> #46 @ (6,5) up")).toBeVisible();
    await expect(await canvas.findByText("round-complete: them -> me")).toBeVisible();
  },
};

export const DiscardWhenUnplaceable: Story = {
  args: {
    title: "Discard domino when no legal placement exists",
    ruleFocus: "Unplaceable domino is discarded and scores zero",
    given: "A board state where selected domino cannot be legally placed",
    when: "Player resolves placement action",
    expectedOutcome: "Domino is discarded with visible discard state",
  },
  render: () => <RealGameRuleHarness scenario={DISCARD_WHEN_UNPLACEABLE_SCENARIO} />,
  play: async ({ canvas }) => {
    await expect(await canvas.findByText("discard: me -> #46")).toBeVisible();
    await expect(await canvas.findByText("round-complete: them -> me")).toBeVisible();
  },
};

export const GridBoundaryEnforced: Story = {
  // In scope for docs/superpowers/plans/2026-03-25-supported-story-conversion-next-steps.md.
  args: {
    title: "5x5 kingdom boundary enforced",
    ruleFocus: "All placed dominoes must fit inside a 5x5 kingdom",
    given: "A near-full kingdom at boundary limits",
    when: "Player attempts overflow placement",
    expectedOutcome: "Overflow placement is rejected or discarded",
  },
  render: () => <RealGameRuleHarness scenario={GRID_BOUNDARY_RULE_SCENARIO} />,
  play: async ({ canvas }) => {
    await expect(await canvas.findByText(/Placement exceeds 5x5 kingdom/i)).toBeVisible();
    await expect(await canvas.findByText(/place: me ->/i)).toBeVisible();
    await expect(await canvas.findByText("round-complete: them -> me")).toBeVisible();
  },
};

export const FinalTurnNoReselection: Story = {
  // In scope for docs/superpowers/plans/2026-03-25-supported-story-conversion-next-steps.md.
  args: {
    title: "Final turn places only",
    ruleFocus: "Last line turn has placement action only (no new selection)",
    given: "Final domino line is in progress",
    when: "A player completes their final action",
    expectedOutcome: "No next-line selection UI appears",
  },
  render: () => <RealGameRuleHarness scenario={FIRST_ROUND_RULE_SCENARIO} />,
  play: async ({ canvas }) => {
    await expect(await canvas.findByText("game-ended: me:2, them:0")).toBeVisible();
    await expect(canvas.getByText("Round phase: none")).toBeVisible();
    await expect(canvas.getAllByText(/^pick:/i)).toHaveLength(2);
    await expect(canvas.getAllByText(/^round-started:/i)).toHaveLength(1);
  },
};
