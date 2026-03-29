import { CommitmentSeedProvider, RandomSeedProvider } from "kingdomino-commitment";
import type { CommitmentTransport } from "kingdomino-commitment";
import type { SeedProvider } from "kingdomino-engine";
import { ConnectionManager, RandomAIPlayer } from "kingdomino-protocol";
import { GameSession, Player } from "kingdomino-engine";
import type { GameEventBus, GameEvent, CardId } from "kingdomino-engine";
import type { WireMessage, WireMessagePayload, WireMessageType } from "kingdomino-protocol";
import { PICK, PLACE, DISCARD } from "kingdomino-protocol";
import { SoloConnection } from "./connection.solo";
import type { GameVariant } from "kingdomino-engine";
import type { GameBonuses } from "kingdomino-engine";

const CONTROL_TIMEOUT_MS = 5000;

// ── Connection interface ───────────────────────────────────────────────────────

export interface IGameConnection {
  readonly peerIdentifiers: { me: string; them: string };
  send: (message: WireMessage) => void;
  waitFor: <T extends WireMessageType>(messageType: T) => Promise<WireMessagePayload<T>>;
  destroy: () => void;
}

/** Internal phase names used by LobbyFlow — independent of UI room constants. */
export type FlowPhase = "splash" | "lobby" | "game" | "paused" | "ended";

/**
 * Adapter interface that decouples LobbyFlow from any specific UI framework or store.
 * The App layer provides AppFlowAdapter; tests can provide a test double.
 */
export interface FlowAdapter {
  setSession(session: GameSession | null): void;
  setPhase(phase: FlowPhase): void;
  getPhase(): FlowPhase;
  oncePhaseIsNot(phase: FlowPhase): Promise<void>;
  awaitStart(): Promise<void>;
  awaitLeave(): Promise<void>;
  awaitPause(): Promise<void>;
  awaitResume(): Promise<void>;
  reset(): void;
}

type LobbyFlowOptions = {
  adapter: FlowAdapter;
  createConnectionManager?: (connection: IGameConnection) => ConnectionManager;
  createSeedProvider?: (connection: IGameConnection) => SeedProvider;
  variant?: GameVariant;
  bonuses?: GameBonuses;
};

// ── Event-based waiting (replaces waitForComputed) ──────────────────────────────

/**
 * Resolves the next time the given event fires (optionally filtered by predicate).
 * The listener is registered synchronously, so there is no race between
 * an awaited operation completing and the next waitForEvent() call.
 */
function waitForEvent<T extends GameEvent["type"]>(
  bus: GameEventBus,
  event: T,
  predicate?: (data: Extract<GameEvent, { type: T }>) => boolean,
): Promise<Extract<GameEvent, { type: T }>> {
  return new Promise((resolve) => {
    const off = bus.on(event, (data) => {
      if (!predicate || predicate(data)) {
        off();
        resolve(data);
      }
    });
  });
}

// ── LobbyFlow class ───────────────────────────────────────────────────────────

export class LobbyFlow {
  private isRunning = false;
  private session: GameSession | null = null;
  private connectionManager: ConnectionManager | null = null;
  private aiPlayer: RandomAIPlayer | null = null;
  private soloConnection: SoloConnection | null = null;
  private readonly adapter: FlowAdapter;
  private readonly createConnectionManager: (connection: IGameConnection) => ConnectionManager;
  private readonly createSeedProvider: ((connection: IGameConnection) => SeedProvider) | undefined;
  private readonly variant: GameVariant;
  private readonly bonuses: GameBonuses;

  constructor(options: LobbyFlowOptions) {
    this.adapter = options.adapter;
    this.createConnectionManager =
      options.createConnectionManager ??
      ((connection) => new ConnectionManager(connection.send, connection.waitFor));
    this.createSeedProvider = options.createSeedProvider;
    this.variant = options.variant ?? "standard";
    this.bonuses = options.bonuses ?? {};
  }

  ready(connection: IGameConnection) {
    if (this.isRunning) return;
    this.isRunning = true;
    void this.runFlow(connection);
  }

  ReadySolo() {
    if (this.isRunning) return;
    this.isRunning = true;
    this.aiPlayer = new RandomAIPlayer("them", "me", this.variant);
    this.soloConnection = new SoloConnection(this.aiPlayer);
    void this.runFlow(this.soloConnection, new RandomSeedProvider());
  }

  ReadyMultiplayer() {
    // Multiplayer transport wiring is not implemented yet.
    // Keep this as a safe no-op until a transport is configured.
    this.adapter.setSession(null);
    this.adapter.setPhase("splash");
  }

  private listenForControlMessages(session: GameSession): void {
    void this.connectionManager!.waitForPauseRequest().then(() => {
      if (session.phase === "playing") session.pause();
    });
    void this.connectionManager!.waitForResumeRequest().then(() => {
      if (session.phase === "paused") session.resume();
    });
    void this.connectionManager!.waitForExitRequest().then(() => this.adapter.reset());
  }

  private async relayRemoteMoves(session: GameSession, connection: IGameConnection): Promise<void> {
    const remoteId = connection.peerIdentifiers.them;
    try {
      while (session.phase === "playing" || session.phase === "paused") {
        const msg = await this.connectionManager!.waitForNextMoveMessage();
        if (msg.type === PICK)    session.handlePick(remoteId, msg.cardId);
        if (msg.type === PLACE)   session.handlePlacement(remoteId, msg.x, msg.y, msg.direction);
        if (msg.type === DISCARD) session.handleDiscard(remoteId);
      }
    } catch {
      // Connection destroyed or game ended
    }
  }

  private async runFlow(connection: IGameConnection, seedProviderOverride?: SeedProvider) {
    const seedProvider = seedProviderOverride
      ?? this.createSeedProvider?.(connection)
      ?? new CommitmentSeedProvider(connection as unknown as CommitmentTransport);

    const session = new GameSession({
      variant: this.variant,
      bonuses: this.bonuses,
      localPlayerId: connection.peerIdentifiers.me,
      seedProvider,
    });
    this.session = session;
    this.connectionManager = this.createConnectionManager(connection);

    try {
      session.addPlayer(new Player(connection.peerIdentifiers.me));
      session.addPlayer(new Player(connection.peerIdentifiers.them));
      this.adapter.setSession(session);
      this.adapter.setPhase("lobby");

      // Lobby phase: race start vs leave
      const lobbyResult = await Promise.race([
        this.adapter.awaitStart().then(() => "start" as const),
        this.adapter.awaitLeave().then(() => "leave" as const),
      ]);

      if (lobbyResult === "leave") {
        this.adapter.setSession(null);
        this.adapter.setPhase("splash");
        return;
      }

      this.adapter.setPhase("game");

      // Sync engine phase changes to adapter
      session.events.on("game:paused",  () => this.adapter.setPhase("paused"));
      session.events.on("game:resumed", () => this.adapter.setPhase("game"));

      // Wire local pause intent → peer handshake → engine
      void this.adapter.awaitPause().then(async () => {
        if (!this.connectionManager) return;
        this.connectionManager.sendPauseRequest();
        try {
          await this.connectionManager.waitForPauseAck(CONTROL_TIMEOUT_MS);
          session.pause();
        } catch { /* peer didn't ack in time — stay in game */ }
      });

      // Wire local resume intent → peer handshake → engine
      void this.adapter.awaitResume().then(async () => {
        if (!this.connectionManager) return;
        this.connectionManager.sendResumeRequest();
        try {
          await this.connectionManager.waitForResumeAck(CONTROL_TIMEOUT_MS);
          session.resume();
        } catch { /* peer didn't ack in time — stay paused */ }
      });

      // Wire in-game leave → send exit to peer and reset
      void this.adapter.awaitLeave().then(() => {
        this.connectionManager?.sendExitRequest();
        this.adapter.reset();
      });

      // Wire incoming control messages (pause/resume/exit from peer)
      this.listenForControlMessages(session);

      // Wire AI for solo mode: notify AI when game starts and each round begins
      if (this.aiPlayer && this.soloConnection) {
        const aiPlayer = this.aiPlayer;
        const soloConn = this.soloConnection;
        session.events.on("game:started", ({ pickOrder }) => {
          aiPlayer.startGame(pickOrder.map((p) => p.id));
        });
        session.events.on("round:started", ({ round }) => {
          const cardIds = round.deal.snapshot().map((s) => s.cardId) as [CardId, CardId, CardId, CardId];
          aiPlayer.beginRound(cardIds);
          soloConn.notifyRoundStarted();
        });
      }

      // Engine drives all rounds via SeedProvider
      session.startGame();

      // Relay local moves to peer
      const localId = connection.peerIdentifiers.me;
      const off1 = session.events.on("pick:made",    (e) => { if (e.player.id === localId) this.connectionManager!.sendPick(e.player.id, e.cardId); });
      const off2 = session.events.on("place:made",   (e) => { if (e.player.id === localId) this.connectionManager!.sendPlace(e.player.id, e.x, e.y, e.direction); });
      const off3 = session.events.on("discard:made", (e) => { if (e.player.id === localId) this.connectionManager!.sendDiscard(e.player.id); });

      // Feed remote moves into engine
      void this.relayRemoteMoves(session, connection);

      await waitForEvent(session.events, "game:ended");
      off1(); off2(); off3();
      this.adapter.setPhase("ended");
    } catch (e) {
      console.error(e);
      this.adapter.setSession(null);
      this.adapter.setPhase("splash");
    } finally {
      connection.destroy();
      this.aiPlayer = null;
      this.soloConnection = null;
      this.session = null;
      this.connectionManager = null;
      this.isRunning = false;
    }
  }
}

