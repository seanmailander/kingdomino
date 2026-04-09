import { afterEach, describe, expect, it, vi } from "vitest";

import {
  getCurrentSession,
  getRoom,
  setCurrentSession,
  setRoom,
  triggerLobbyLeave,
  resetAppState,
  triggerLobbyStart,
  triggerPauseIntent,
  triggerResumeIntent,
} from "../../App/store";
import type { RosterConfig } from "../../Lobby/lobby.types";
import { Splash, Lobby, Game, GamePaused, GameEnded } from "../../App/AppExtras";
import { LobbyFlow } from "./game.flow";
import { AppFlowAdapter } from "../../App/AppFlowAdapter";
import { DefaultRosterFactory } from "./default.roster.factory";

const minimalConfig: RosterConfig = [{ type: "local" }, { type: "ai" }];
const allAiConfig: RosterConfig = [{ type: "ai" }, { type: "ai" }];

describe("LobbyFlow", () => {
  afterEach(async () => {
    resetAppState();
    await vi.waitFor(() => {
      expect(getRoom()).toBe(Splash);
    });
  });

  it("enters lobby phase when start() is called", async () => {
    setCurrentSession(null);
    setRoom(Splash);

    const flow = new LobbyFlow({
      adapter: new AppFlowAdapter(),
      rosterFactory: new DefaultRosterFactory(),
    });

    expect(() => flow.start()).not.toThrow();

    await vi.waitFor(() => {
      expect(getRoom()).toBe(Lobby);
    });
  });

  it("creates a session with correct player IDs after lobby start", async () => {
    setCurrentSession(null);
    setRoom(Splash);

    const flow = new LobbyFlow({
      adapter: new AppFlowAdapter(),
      rosterFactory: new DefaultRosterFactory(),
    });
    flow.start();

    await vi.waitFor(() => expect(getRoom()).toBe(Lobby));
    triggerLobbyStart(minimalConfig);

    await vi.waitFor(() => {
      expect(getRoom()).toBe(Game);
      expect(getCurrentSession()?.players.map((player) => player.id)).toEqual(["p1", "p2"]);
    });
  });
});

describe("LobbyFlow control transitions", () => {
  afterEach(async () => {
    resetAppState();
    await vi.waitFor(() => {
      expect(getRoom()).toBe(Splash);
    });
  });

  it("enters GamePaused after local pause intent", async () => {
    setCurrentSession(null);
    setRoom(Splash);
    const flow = new LobbyFlow({
      adapter: new AppFlowAdapter(),
      rosterFactory: new DefaultRosterFactory(),
    });
    flow.start();

    await vi.waitFor(() => expect(getRoom()).toBe(Lobby));
    triggerLobbyStart(minimalConfig);
    await vi.waitFor(() => expect(getRoom()).toBe(Game));

    triggerPauseIntent();

    await vi.waitFor(() => expect(getRoom()).toBe(GamePaused), { timeout: 3000 });
  });

  it("returns to Game state after local resume", async () => {
    setCurrentSession(null);
    setRoom(Splash);
    const flow = new LobbyFlow({
      adapter: new AppFlowAdapter(),
      rosterFactory: new DefaultRosterFactory(),
    });
    flow.start();

    await vi.waitFor(() => expect(getRoom()).toBe(Lobby));
    triggerLobbyStart(minimalConfig);
    await vi.waitFor(() => expect(getRoom()).toBe(Game));

    triggerPauseIntent();
    await vi.waitFor(() => expect(getRoom()).toBe(GamePaused), { timeout: 3000 });

    triggerResumeIntent();
    await vi.waitFor(() => expect(getRoom()).toBe(Game), { timeout: 3000 });
  });
});

describe("LobbyFlow game completion", () => {
  afterEach(async () => {
    resetAppState();
    await vi.waitFor(() => expect(getRoom()).toBe(Splash));
  });

  it("transitions room to GameEnded when the game completes normally", async () => {
    setCurrentSession(null);
    setRoom(Splash);

    const flow = new LobbyFlow({
      adapter: new AppFlowAdapter(),
      rosterFactory: new DefaultRosterFactory(),
    });
    flow.start();

    await vi.waitFor(() => expect(getRoom()).toBe(Lobby));
    triggerLobbyStart(allAiConfig);

    // With all-AI actors the game completes almost instantly — the Game
    // phase is transient, so just wait for the final GameEnded state.
    await vi.waitFor(() => expect(getRoom()).toBe(GameEnded), { timeout: 15000 });
  }, 20000);
});
