import { afterEach, describe, expect, it, vi } from "vitest";

import {
  getCurrentSession,
  getRoom,
  setCurrentSession,
  setRoom,
  triggerLobbyLeave,
} from "../../App/store";
import { Splash, Lobby } from "../../App/AppExtras";
import { LobbyFlow } from "./game.flow";
import {
  MOVE,
  type GameMessage,
  type GameMessagePayload,
  type GameMessageType,
} from "./game.messages";

class StubConnection {
  readonly peerIdentifiers = {
    me: "story-me",
    them: "story-them",
  } as const;

  send(_message: GameMessage) {}

  waitFor<T extends GameMessageType>(_messageType: T): Promise<GameMessagePayload<T>> {
    return new Promise(() => undefined);
  }

  destroy() {}
}

describe("LobbyFlow", () => {
  afterEach(async () => {
    triggerLobbyLeave();
    await vi.waitFor(() => {
      expect(getRoom()).toBe(Splash);
      expect(getCurrentSession()).toBeNull();
    });
  });

  it("starts a lobby with an explicit connection instance", async () => {
    setCurrentSession(null);
    setRoom(Splash);

    const flow = new LobbyFlow();
    const connection = new StubConnection();

    expect(() =>
      (flow as LobbyFlow & { ready: (connection: StubConnection) => void }).ready(connection),
    ).not.toThrow();

    await vi.waitFor(() => {
      expect(getRoom()).toBe(Lobby);
      expect(getCurrentSession()?.players.map((player) => player.id)).toEqual([
        connection.peerIdentifiers.me,
        connection.peerIdentifiers.them,
      ]);
    });
  });

  it("ReadySolo still starts the solo lobby flow", async () => {
    setCurrentSession(null);
    setRoom(Splash);

    const flow = new LobbyFlow();
    flow.ReadySolo();

    await vi.waitFor(() => {
      expect(getRoom()).toBe(Lobby);
      expect(getCurrentSession()?.players.map((player) => player.id)).toEqual(["me", "them"]);
    });
  });
});
