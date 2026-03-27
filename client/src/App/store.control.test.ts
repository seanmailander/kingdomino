import { describe, expect, it } from "vitest";
import {
  awaitPauseIntent,
  triggerPauseIntent,
  awaitExitConfirm,
  triggerExitConfirm,
  resetAppState,
} from "./store";

describe("store control intents", () => {
  it("resolves pause waiters when pause is triggered", async () => {
    const waiter = awaitPauseIntent();
    triggerPauseIntent();
    await expect(waiter).resolves.toBeUndefined();
  });

  it("clears pending waiters on reset", async () => {
    const waiter = awaitExitConfirm();
    resetAppState();
    triggerExitConfirm(true);
    await expect(waiter).resolves.toBeUndefined();
  });
});
