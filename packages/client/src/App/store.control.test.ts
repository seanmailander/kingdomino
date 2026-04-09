import { describe, expect, it } from "vitest";
import { GameStore } from "./GameStore";

describe("GameStore control intents", () => {
  it("resolves pause waiters when pause is triggered", async () => {
    const store = new GameStore();
    const waiter = store.awaitPauseIntent();
    store.triggerPauseIntent();
    await expect(waiter).resolves.toBeUndefined();
  });

  it("resolves resume waiters when resume is triggered", async () => {
    const store = new GameStore();
    const waiter = store.awaitResumeIntent();
    store.triggerResumeIntent();
    await expect(waiter).resolves.toBeUndefined();
  });

  it("resolves exit confirm waiters with value", async () => {
    const store = new GameStore();
    const waiter = store.awaitExitConfirm();
    store.triggerExitConfirm(true);
    await expect(waiter).resolves.toBe(true);
  });

  it("resolves lobby leave waiters when triggered", async () => {
    const store = new GameStore();
    const waiter = store.awaitLobbyLeave();
    store.triggerLobbyLeave();
    await expect(waiter).resolves.toBeUndefined();
  });

  it("dispose clears resolver queues without resolving them", () => {
    const store = new GameStore();
    store.awaitLobbyStart();
    store.awaitPauseIntent();
    expect(() => store.dispose()).not.toThrow();
  });
});
