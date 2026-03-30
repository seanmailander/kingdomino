import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect, fn, userEvent } from "storybook/test";

import { Lobby } from "./Lobby";

const meta = {
  title: "Lobby/Lobby",
  component: Lobby,
  tags: ["autodocs"],
  args: {
    onStart: fn(),
    onLeave: fn(),
  },
} satisfies Meta<typeof Lobby>;

export default meta;
type Story = StoryObj<typeof meta>;

export const TwoPlayerDefault: Story = {
  play: async ({ canvas }) => {
    await expect(canvas.getByRole("heading", { name: "Lobby" })).toBeVisible();
    const startBtn = canvas.getByRole("button", { name: "Start game" });
    await expect(startBtn).not.toBeDisabled();
    // Slot 2 AI button should be pressed
    const items = canvas.getAllByRole("listitem");
    const slot2 = items[1];
    const aiBtn = slot2.querySelector("button[aria-pressed='true']");
    await expect(aiBtn).not.toBeNull();
    await expect(aiBtn?.textContent).toBe("AI");
  },
};

export const FourPlayerMixed: Story = {
  play: async ({ canvas }) => {
    const user = userEvent.setup();
    // Set to 4 players
    await user.click(canvas.getByRole("button", { name: "4" }));
    // Slot 2: set to Couch
    const items = () => canvas.getAllByRole("listitem");
    const slot2Couch = items()[1].querySelector("button:nth-of-type(2)") as HTMLButtonElement;
    await user.click(slot2Couch);
    // Slot 4: set to Remote
    const slot4Buttons = items()[3].querySelectorAll("button");
    const remoteBtn = Array.from(slot4Buttons).find((b) => b.textContent === "Remote") as HTMLButtonElement;
    await user.click(remoteBtn);
    // Type peer ID in slot 4 input
    const peerInput = items()[3].querySelector("input") as HTMLInputElement;
    await user.type(peerInput, "peer-abc123");
    // Start should be enabled
    await expect(canvas.getByRole("button", { name: "Start game" })).not.toBeDisabled();
    // Peer ID input shows value
    await expect(peerInput.value).toBe("peer-abc123");
  },
};

export const RemoteSlotPending: Story = {
  play: async ({ canvas }) => {
    const user = userEvent.setup();
    // Slot 2: set to Remote
    const items = canvas.getAllByRole("listitem");
    const slot2Buttons = items[1].querySelectorAll("button");
    const remoteBtn = Array.from(slot2Buttons).find((b) => b.textContent === "Remote") as HTMLButtonElement;
    await user.click(remoteBtn);
    // Start should be disabled (no peerId)
    await expect(canvas.getByRole("button", { name: "Start game" })).toBeDisabled();
    // Peer ID input exists in slot 2
    await expect(items[1].querySelector("input")).not.toBeNull();
  },
};

export const AllAI: Story = {
  play: async ({ canvas }) => {
    const user = userEvent.setup();
    // Set to 4 players
    await user.click(canvas.getByRole("button", { name: "4" }));
    // Set all slots to AI
    const items = () => canvas.getAllByRole("listitem");
    for (let i = 0; i < 4; i++) {
      const aiBtn = Array.from(items()[i].querySelectorAll("button")).find(
        (b) => b.textContent === "AI"
      ) as HTMLButtonElement;
      await user.click(aiBtn);
    }
    // Four list items exist
    await expect(canvas.getAllByRole("listitem")).toHaveLength(4);
    // Start should be enabled (no remote slots)
    await expect(canvas.getByRole("button", { name: "Start game" })).not.toBeDisabled();
  },
};
