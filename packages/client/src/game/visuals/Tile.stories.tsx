import React from "react";
import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect, within } from "storybook/test";

import { Tile } from "./Tile";
import { wood, grain, water, mine, noCrown, oneCrown, twoCrown, threeCrown } from "kingdomino-engine";

const meta = {
  title: "Game/Tile",
  component: Tile,
  tags: ["autodocs", "snapshot"],
  decorators: [
    (Story) => (
      <div data-testid="subject" style={{ width: 80, height: 80, display: "inline-block" }}>
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof Tile>;

export default meta;
type Story = StoryObj<typeof meta>;

export const NoCrowns: Story = {
  args: { tile: wood, value: noCrown },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.queryByRole("img", { name: /crown/i })).toBeNull();
    await expect(canvas.queryByLabelText(/crown/i)).toBeNull();
  },
};

export const OneCrown: Story = {
  args: { tile: grain, value: oneCrown },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByLabelText("1 crown")).toBeVisible();
    await expect(canvas.getByLabelText("1 crown").textContent).toBe("♛");
  },
};

export const TwoCrowns: Story = {
  args: { tile: water, value: twoCrown },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByLabelText("2 crowns")).toBeVisible();
    await expect(canvas.getByLabelText("2 crowns").textContent).toBe("♛♛");
  },
};

export const ThreeCrowns: Story = {
  args: { tile: mine, value: threeCrown },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByLabelText("3 crowns")).toBeVisible();
    await expect(canvas.getByLabelText("3 crowns").textContent).toBe("♛♛♛");
  },
};
