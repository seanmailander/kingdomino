import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect, userEvent, within } from "storybook/test";

import {
  DISCARD_WHEN_UNPLACEABLE_SCENARIO,
  FIRST_ROUND_RULE_SCENARIO,
  GRID_BOUNDARY_RULE_SCENARIO,
  PAUSABLE_GAME_SCENARIO,
  PLACEMENT_CONNECT_LEGALITY_SCENARIO,
  RealGameRuleHarness,
  RuleScenarioScaffold,
  getHarnessStore,
} from "./GameRulesVisualTdd.shared";

const meta = {
  title: "Game/Rules Visual TDD/Play",
  component: RuleScenarioScaffold,
  tags: ["autodocs"],
} satisfies Meta<typeof RuleScenarioScaffold>;

export default meta;
type Story = StoryObj<typeof meta>;

export const TurnOrderFromDominoSelection: Story = {
  tags: ["failing-test"],
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
    await expect(canvas.getByText(/^pick: them -> #\d+/)).toBeVisible();
    await expect(canvas.getByText(/^pick: me -> #\d+/)).toBeVisible();
    await expect(canvas.getByText("round-complete: them -> me")).toBeVisible();
    await expect(canvas.getByText("Pick order: them -> me")).toBeVisible();
    await expect(canvas.getByRole("rowheader", { name: "me" })).toBeVisible();
    await expect(canvas.getByRole("rowheader", { name: "them" })).toBeVisible();
  },
};

export const PlacementMustConnectLegally: Story = {
  tags: ["failing-test"],
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
    await expect(await canvas.findByText(/^place: me -> #\d+ @ \(6,5\) up/)).toBeVisible();
    await expect(await canvas.findByText("round-complete: them -> me")).toBeVisible();
  },
};

export const DiscardWhenUnplaceable: Story = {
  tags: ["failing-test"],
  args: {
    title: "Discard domino when no legal placement exists",
    ruleFocus: "Unplaceable domino is discarded and scores zero",
    given: "A board state where selected domino cannot be legally placed",
    when: "Player resolves placement action",
    expectedOutcome: "Domino is discarded with visible discard state",
  },
  render: () => <RealGameRuleHarness scenario={DISCARD_WHEN_UNPLACEABLE_SCENARIO} />,
  play: async ({ canvas }) => {
    await expect(await canvas.findByText(/^discard: me -> #\d+/)).toBeVisible();
    await expect(await canvas.findByText("round-complete: them -> me")).toBeVisible();
  },
};

export const GridBoundaryEnforced: Story = {
  tags: ["failing-test"],
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
  tags: ["failing-test"],
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
    await expect(await canvas.findByText("game-ended: me:1, them:0")).toBeVisible();
    await expect(canvas.getByText("Round phase: none")).toBeVisible();
    await expect(canvas.getAllByText(/^pick:/i)).toHaveLength(2);
    await expect(canvas.getAllByText(/^round-started:/i)).toHaveLength(1);
  },
};

export const PausedState: Story = {
  args: {
    title: "Game paused state",
    ruleFocus: "Pause overlay shown; gameplay input locked",
    given: "A game is in progress",
    when: "The local player triggers pause and remote acks",
    expectedOutcome: "PauseOverlay appears; card picks and placements are disabled",
  },
  render: () => <RealGameRuleHarness scenario={PAUSABLE_GAME_SCENARIO} />,
  play: async ({ canvas }) => {
    // Wait for game to enter active Game state
    await expect(await canvas.findByText("Room: Game")).toBeVisible();

    // Trigger pause from the store (simulates Pause button in UI)
    getHarnessStore(canvas).triggerPauseIntent();

    // PauseOverlay should appear
    await expect(await canvas.findByRole("button", { name: /resume/i })).toBeVisible();
    await expect(canvas.getByRole("button", { name: /exit/i })).toBeVisible();

    // The "Game Paused" heading in PauseOverlay should be visible
    await expect(canvas.getByRole("heading", { name: /game paused/i })).toBeVisible();
  },
};

export const ExitConfirmState: Story = {
  args: {
    title: "Exit confirmation dialog",
    ruleFocus: "Player must confirm before exiting a paused game",
    given: "A game is paused",
    when: "The local player clicks Exit",
    expectedOutcome: "ExitConfirmDialog appears with confirm and cancel buttons",
  },
  render: () => <RealGameRuleHarness scenario={PAUSABLE_GAME_SCENARIO} />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    // Reach Game state and pause
    await expect(await canvas.findByText("Room: Game")).toBeVisible();
    getHarnessStore(canvas).triggerPauseIntent();
    const exitBtn = await canvas.findByRole("button", { name: /^exit$/i });
    await expect(exitBtn).toBeVisible();

    // Click Exit in the PauseOverlay
    await userEvent.click(exitBtn);

    // Exit confirmation dialog should appear
    await expect(await canvas.findByRole("button", { name: /exit game/i })).toBeVisible();
    await expect(canvas.getByRole("button", { name: /cancel/i })).toBeVisible();
  },
};
