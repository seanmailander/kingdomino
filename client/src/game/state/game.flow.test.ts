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
import { Splash, Lobby, Game, GamePaused } from "../../App/AppExtras";
import { LobbyFlow } from "./game.flow";
import {
  MOVE,
  type GameMessage,
  type GameMessagePayload,
  type GameMessageType,
} from "./game.messages";
import { TestConnection } from "./connection.testing";

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

describe("LobbyFlow control transitions", () => {
  afterEach(async () => {
    resetAppState();
    await vi.waitFor(() => {
      expect(getRoom()).toBe(Splash);
    });
  });

  it("enters GamePaused after pause request/ack handshake (local initiates)", async () => {
    setCurrentSession(null);
    setRoom(Splash);
    const flow = new LobbyFlow();
    const connection = new TestConnection({
      scenario: {
        handshakes: [{ secret: 1 }, { secret: 2 }, { secret: 3 }, { secret: 4 }],
        moves: [
          { card: 1, x: 0, y: 1, direction: "up" },
          { card: 2, x: 0, y: 2, direction: "up" },
          { card: 3, x: 0, y: 3, direction: "up" },
        ],
        control: { respondToPauseRequest: true },
      },
    });
    flow.ready(connection);

    await vi.waitFor(() => expect(getRoom()).toBe(Lobby));
    triggerLobbyStart();
    await vi.waitFor(() => expect(getRoom()).toBe(Game));

    triggerPauseIntent();

    await vi.waitFor(() => expect(getRoom()).toBe(GamePaused), { timeout: 3000 });
  });

  it("handles incoming pause request from remote (remote initiates)", async () => {
    setCurrentSession(null);
    setRoom(Splash);
    const flow = new LobbyFlow();
    const connection = new TestConnection({
      scenario: {
        handshakes: [{ secret: 1 }, { secret: 2 }, { secret: 3 }, { secret: 4 }],
        moves: [
          { card: 1, x: 0, y: 1, direction: "up" },
          { card: 2, x: 0, y: 2, direction: "up" },
          { card: 3, x: 0, y: 3, direction: "up" },
        ],
        control: { sendPauseRequestOnStart: true },
      },
    });
    flow.ready(connection);

    await vi.waitFor(() => expect(getRoom()).toBe(Lobby));
    triggerLobbyStart();
    await vi.waitFor(() => expect(getRoom()).toBe(Game));

    await vi.waitFor(() => expect(getRoom()).toBe(GamePaused), { timeout: 3000 });
  });

  it("returns to Game state after local resume", async () => {
    setCurrentSession(null);
    setRoom(Splash);
    const flow = new LobbyFlow();
    const connection = new TestConnection({
      scenario: {
        handshakes: [{ secret: 1 }, { secret: 2 }, { secret: 3 }, { secret: 4 }],
        moves: [],
        control: { respondToPauseRequest: true, respondToResumeRequest: true },
      },
    });
    flow.ready(connection);

    await vi.waitFor(() => expect(getRoom()).toBe(Lobby));
    triggerLobbyStart();
    await vi.waitFor(() => expect(getRoom()).toBe(Game));

    triggerPauseIntent();
    await vi.waitFor(() => expect(getRoom()).toBe(GamePaused), { timeout: 3000 });

    triggerResumeIntent();
    await vi.waitFor(() => expect(getRoom()).toBe(Game), { timeout: 3000 });
  });
});
