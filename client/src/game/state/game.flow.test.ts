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
import { Splash, Lobby, Game, GamePaused, GameEnded } from "../../App/AppExtras";
import { LobbyFlow } from "./game.flow";
import { AppFlowAdapter } from "../../App/AppFlowAdapter";
import { findPlacementWithin5x5 } from "kingdomino-engine";
import {
  type WireMessage,
  type WireMessagePayload,
  type WireMessageType,
} from "./game.messages";
import { TestConnection } from "./connection.testing";

class StubConnection {
  readonly peerIdentifiers = {
    me: "story-me",
    them: "story-them",
  } as const;

  send(_message: WireMessage) {}

  waitFor<T extends WireMessageType>(_messageType: T): Promise<WireMessagePayload<T>> {
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

    const flow = new LobbyFlow({ adapter: new AppFlowAdapter() });
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

    const flow = new LobbyFlow({ adapter: new AppFlowAdapter() });
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
    const flow = new LobbyFlow({ adapter: new AppFlowAdapter() });
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
    const flow = new LobbyFlow({ adapter: new AppFlowAdapter() });
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
    const flow = new LobbyFlow({ adapter: new AppFlowAdapter() });
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

describe("LobbyFlow game completion", () => {
  afterEach(async () => {
    resetAppState();
    await vi.waitFor(() => expect(getRoom()).toBe(Splash));
  });

  it("transitions room to GameEnded when the game completes normally", async () => {
    setCurrentSession(null);
    setRoom(Splash);

    // Use ReadySolo so the AI (SoloConnection + RandomAIPlayer) handles the remote
    // player automatically. shouldContinuePlaying stops after 1 completed round.
    const flow = new LobbyFlow({ adapter: new AppFlowAdapter(), shouldContinuePlaying: (n) => n < 1 });
    flow.ReadySolo();

    await vi.waitFor(() => expect(getRoom()).toBe(Lobby));
    triggerLobbyStart();
    await vi.waitFor(() => expect(getRoom()).toBe(Game), { timeout: 3000 });

    // Poll every 50ms: drive the local player whenever it's our turn.
    // Using setInterval instead of event listeners avoids the gap where driveTurn
    // fires before the AI finishes and no future event re-triggers it.
    const driveInterval = setInterval(() => {
      const session = getCurrentSession();
      if (!session) return;
      try {
        if (session.isMyTurn()) {
          const snap = session.currentRound?.deal.snapshot();
          const card = snap?.find((s) => s.pickedBy === null);
          if (card) session.handleLocalPick(card.cardId);
        } else if (session.isMyPlace()) {
          const cardId = session.localCardToPlace();
          const me = session.myPlayer();
          if (cardId !== undefined && me) {
            const board = session.boardFor(me.id);
            const placement = findPlacementWithin5x5(board, cardId);
            if (placement) session.handleLocalPlacement(placement.x, placement.y, placement.direction);
          }
        }
      } catch {
        // ignore transient state errors between polls
      }
    }, 50);

    try {
      await vi.waitFor(() => expect(getRoom()).toBe(GameEnded), { timeout: 10000 });
    } finally {
      clearInterval(driveInterval);
    }
  }, 15000);
});
