import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect } from "storybook/test";

import { RuleScenarioScaffold, TurnOrderHarness } from "./GameRulesVisualTdd.shared";

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
  render: () => <TurnOrderHarness />,
  play: async ({ canvas }) => {
    await expect(
      canvas.getByRole("heading", { name: "Turn order from chosen domino positions" }),
    ).toBeVisible();

    const lineOrderTable = canvas.getByRole("table", {
      name: "Current line king turn order",
    });

    await expect(lineOrderTable).toBeVisible();
    await expect(canvas.getByRole("rowheader", { name: "1st" })).toHaveTextContent("1st");
    await expect(canvas.getByRole("rowheader", { name: "2nd" })).toHaveTextContent("2nd");
    await expect(canvas.getByRole("rowheader", { name: "3rd" })).toHaveTextContent("3rd");
    await expect(lineOrderTable).toHaveTextContent("Blue king");
    await expect(lineOrderTable).toHaveTextContent("Yellow king");
    await expect(lineOrderTable).toHaveTextContent("Pink king");
  },
};

export const PlacementMustConnectLegally: Story = {
  args: {
    title: "Placement must connect to castle or matching terrain",
    ruleFocus: "Domino placement requires valid orthogonal connection",
    given: "A board with castle and existing terrain regions",
    when: "A player attempts legal and illegal placements",
    expectedOutcome: "Only legal placements are accepted",
  },
  play: async () => {
    // TODO: Simulate placement attempts and verify accept/reject feedback.
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
  play: async () => {
    // TODO: Assert discard UI state and no board mutation from discarded domino.
  },
};

export const GridBoundaryEnforced: Story = {
  args: {
    title: "5x5 kingdom boundary enforced",
    ruleFocus: "All placed dominoes must fit inside a 5x5 kingdom",
    given: "A near-full kingdom at boundary limits",
    when: "Player attempts overflow placement",
    expectedOutcome: "Overflow placement is rejected or discarded",
  },
  play: async () => {
    // TODO: Assert board bounds visualization and overflow handling.
  },
};

export const FinalTurnNoReselection: Story = {
  args: {
    title: "Final turn places only",
    ruleFocus: "Last line turn has placement action only (no new selection)",
    given: "Final domino line is in progress",
    when: "A player completes their final action",
    expectedOutcome: "No next-line selection UI appears",
  },
  play: async () => {
    // TODO: Assert selection affordances are absent on final turn.
  },
};
