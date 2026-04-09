import { describe, expect, it, vi } from "vitest";

import { GameStore } from "../../App/GameStore";
import { AppFlowAdapter } from "../../App/AppFlowAdapter";
import { LobbyFlow } from "./game.flow";
import { DefaultRosterFactory } from "./default.roster.factory";
import type { RosterConfig } from "../../Lobby/lobby.types";

const minimalConfig: RosterConfig = [{ type: "local" }, { type: "ai" }];
const allAiConfig: RosterConfig = [{ type: "ai" }, { type: "ai" }];

describe("LobbyFlow", () => {
  it("enters lobby phase when start() is called", async () => {
    const store = new GameStore();
    const flow = new LobbyFlow({
      adapter: new AppFlowAdapter(store),
      rosterFactory: new DefaultRosterFactory(),
    });

    expect(() => flow.start()).not.toThrow();

    await vi.waitFor(() => {
      expect(store.getRoom()).toBe("Lobby");
    });
  });

  it("creates a session with correct player IDs after lobby start", async () => {
    const store = new GameStore();
    const flow = new LobbyFlow({
      adapter: new AppFlowAdapter(store),
      rosterFactory: new DefaultRosterFactory(),
    });
    flow.start();

    await vi.waitFor(() => expect(store.getRoom()).toBe("Lobby"));
    store.triggerLobbyStart(minimalConfig);

    await vi.waitFor(() => {
      expect(store.getRoom()).toBe("Game");
      expect(store.getSession()?.players.map((p) => p.id)).toEqual(["p1", "p2"]);
    });
  });
});

describe("LobbyFlow control transitions", () => {
  it("enters GamePaused after local pause intent", async () => {
    const store = new GameStore();
    const flow = new LobbyFlow({
      adapter: new AppFlowAdapter(store),
      rosterFactory: new DefaultRosterFactory(),
    });
    flow.start();

    await vi.waitFor(() => expect(store.getRoom()).toBe("Lobby"));
    store.triggerLobbyStart(minimalConfig);
    await vi.waitFor(() => expect(store.getRoom()).toBe("Game"));

    store.triggerPauseIntent();

    await vi.waitFor(() => expect(store.getRoom()).toBe("GamePaused"), { timeout: 3000 });
  });

  it("returns to Game state after local resume", async () => {
    const store = new GameStore();
    const flow = new LobbyFlow({
      adapter: new AppFlowAdapter(store),
      rosterFactory: new DefaultRosterFactory(),
    });
    flow.start();

    await vi.waitFor(() => expect(store.getRoom()).toBe("Lobby"));
    store.triggerLobbyStart(minimalConfig);
    await vi.waitFor(() => expect(store.getRoom()).toBe("Game"));

    store.triggerPauseIntent();
    await vi.waitFor(() => expect(store.getRoom()).toBe("GamePaused"), { timeout: 3000 });

    store.triggerResumeIntent();
    await vi.waitFor(() => expect(store.getRoom()).toBe("Game"), { timeout: 3000 });
  });
});

describe("LobbyFlow game completion", () => {
  it("transitions room to GameEnded when the game completes normally", async () => {
    const store = new GameStore();
    const flow = new LobbyFlow({
      adapter: new AppFlowAdapter(store),
      rosterFactory: new DefaultRosterFactory(),
    });
    flow.start();

    await vi.waitFor(() => expect(store.getRoom()).toBe("Lobby"));
    store.triggerLobbyStart(allAiConfig);

    await vi.waitFor(() => expect(store.getRoom()).toBe("GameEnded"), { timeout: 15000 });
  }, 20000);
});
