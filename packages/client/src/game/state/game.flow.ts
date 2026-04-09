import { CommitmentSeedProvider, RandomSeedProvider } from "kingdomino-commitment";
import type { CommitmentTransport } from "kingdomino-commitment";
import type { SeedProvider } from "kingdomino-engine";
import { ConnectionManager, RandomAIPlayer, GameDriver } from "kingdomino-protocol";
import type { WireMessage, WaitForOneOfFn } from "kingdomino-protocol";
import { GameSession, Player, GAME_PHASE_PLAYING, GAME_PHASE_PAUSED, GAME_STARTED, ROUND_STARTED, GAME_PAUSED, GAME_RESUMED, GAME_ENDED, PICK_MADE, PLACE_MADE, DISCARD_MADE, STANDARD } from "kingdomino-engine";
import type { GameEventBus, GameEvent, CardId } from "kingdomino-engine";
import { PICK, PLACE, DISCARD } from "kingdomino-protocol";
import { SoloConnection } from "./connection.solo";
import type { GameVariant } from "kingdomino-engine";
import type { GameBonuses } from "kingdomino-engine";
import type { RosterConfig } from "../../Lobby/lobby.types";
import type { RosterFactory } from "./RosterFactory";

const CONTROL_TIMEOUT_MS = 5000;

// ── Connection interface ───────────────────────────────────────────────────────

export interface IGameConnection {
  readonly peerIdentifiers: { me: string; them: string };
  send: (message: WireMessage) => void;
  waitForOneOf: WaitForOneOfFn;
  destroy: () => void;
}

export const FLOW_SPLASH = "splash" as const;
export const FLOW_LOBBY  = "lobby"  as const;
export const FLOW_GAME   = "game"   as const;
export const FLOW_PAUSED = "paused" as const;
export const FLOW_ENDED  = "ended"  as const;

/** Internal phase names used by LobbyFlow — independent of UI room constants. */
export type FlowPhase = typeof FLOW_SPLASH | typeof FLOW_LOBBY | typeof FLOW_GAME | typeof FLOW_PAUSED | typeof FLOW_ENDED;

/**
 * Adapter interface that decouples LobbyFlow from any specific UI framework or store.
 * The App layer provides AppFlowAdapter; tests can provide a test double.
 */
export interface FlowAdapter {
  setSession(session: GameSession | null): void;
  setPhase(phase: FlowPhase): void;
  getPhase(): FlowPhase;
  oncePhaseIsNot(phase: FlowPhase): Promise<void>;
  awaitStart(): Promise<RosterConfig>;
  awaitLeave(): Promise<void>;
  awaitPause(): Promise<void>;
  awaitResume(): Promise<void>;
  reset(): void;
}

type LobbyFlowOptions = {
  adapter: FlowAdapter;
  /** Factory that builds actors and a seed provider from the lobby roster config. */
  rosterFactory?: RosterFactory;
  variant?: GameVariant;
  bonuses?: GameBonuses;
  /** @deprecated Legacy connection-based options kept for backward-compat with tests. */
  createConnectionManager?: (connection: IGameConnection) => ConnectionManager;
  /** @deprecated Legacy connection-based options kept for backward-compat with tests. */
  createSeedProvider?: (connection: IGameConnection) => SeedProvider;
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
  private readonly rosterFactory: RosterFactory | undefined;
  private readonly createConnectionManager: (connection: IGameConnection) => ConnectionManager;
  private readonly createSeedProvider: ((connection: IGameConnection) => SeedProvider) | undefined;
  private readonly variant: GameVariant;
  private readonly bonuses: GameBonuses;

  constructor(options: LobbyFlowOptions) {
    this.adapter = options.adapter;
    this.rosterFactory = options.rosterFactory;
    this.createConnectionManager =
      options.createConnectionManager ??
      ((connection) => new ConnectionManager(
        connection.send,
        connection.waitForOneOf.bind(connection),
      ));
    this.createSeedProvider = options.createSeedProvider;
    this.variant = options.variant ?? STANDARD;
    this.bonuses = options.bonuses ?? {};
  }

  /**
   * Factory-driven entry point. Begins the lobby phase, waits for the UI to
   * configure the roster, then builds actors via the injected RosterFactory
   * and drives the game with GameDriver.
   *
   * Requires `rosterFactory` to be provided in LobbyFlowOptions.
   */
  start() {
    if (this.isRunning) return;
    if (!this.rosterFactory) {
      console.error("LobbyFlow.start(): no rosterFactory configured — use ready() for legacy flows");
      return;
    }
    this.isRunning = true;
    void this.runFlowWithFactory();
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
    this.adapter.setPhase(FLOW_SPLASH);
  }

  private async runFlowWithFactory(): Promise<void> {
    try {
      this.adapter.setSession(null);
      this.adapter.setPhase(FLOW_LOBBY);

      const lobbyResult = await Promise.race([
        this.adapter.awaitStart().then((config) => ({ outcome: "start" as const, config })),
        this.adapter.awaitLeave().then(() => ({ outcome: "leave" as const, config: null })),
      ]);

      if (lobbyResult.outcome === "leave") {
        this.adapter.setPhase(FLOW_SPLASH);
        return;
      }

      const { players, seedProvider, localPlayerId } = await this.rosterFactory!.build(lobbyResult.config!);

      const session = new GameSession({
        variant: this.variant,
        bonuses: this.bonuses,
        localPlayerId: localPlayerId ?? players[0].id,
        seedProvider,
      });
      this.session = session;

      for (const { id } of players) {
        session.addPlayer(new Player(id));
      }
      this.adapter.setSession(session);
      this.adapter.setPhase(FLOW_GAME);

      // Sync engine phase changes to adapter
      session.events.on(GAME_PAUSED,  () => this.adapter.setPhase(FLOW_PAUSED));
      session.events.on(GAME_RESUMED, () => this.adapter.setPhase(FLOW_GAME));

      // Wire local pause/resume/leave intents
      // TODO(remote-control): Add peer handshake for remote slots
      void this.adapter.awaitPause().then(() => { if (session.phase === GAME_PHASE_PLAYING) session.pause(); });
      void this.adapter.awaitResume().then(() => { if (session.phase === GAME_PHASE_PAUSED) session.resume(); });
      void this.adapter.awaitLeave().then(() => this.adapter.reset());

      const actorMap = new Map(players.map(({ id, actor }) => [id, actor]));
      const driver = new GameDriver(session, actorMap);
      await driver.run();

      this.adapter.setPhase(FLOW_ENDED);
    } catch (e) {
      console.error(e);
      this.adapter.setSession(null);
      this.adapter.setPhase(FLOW_SPLASH);
    } finally {
      this.session = null;
      this.isRunning = false;
    }
  }

  private listenForControlMessages(session: GameSession): void {
    void this.connectionManager!.waitForPauseRequest().then(() => {
      if (session.phase === GAME_PHASE_PLAYING) session.pause();
    });
    void this.connectionManager!.waitForResumeRequest().then(() => {
      if (session.phase === GAME_PHASE_PAUSED) session.resume();
    });
    void this.connectionManager!.waitForExitRequest().then(() => this.adapter.reset());
  }

  private async relayRemoteMoves(session: GameSession, connection: IGameConnection): Promise<void> {
    const remoteId = connection.peerIdentifiers.them;
    try {
      while (session.phase === GAME_PHASE_PLAYING || session.phase === GAME_PHASE_PAUSED) {
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
    const commitmentTransport: CommitmentTransport = {
      send: connection.send,
      waitFor: (type) => connection.waitForOneOf(type as Parameters<typeof connection.waitForOneOf>[0]) as Promise<never>,
    };
    const seedProvider = seedProviderOverride
      ?? this.createSeedProvider?.(connection)
      ?? new CommitmentSeedProvider(commitmentTransport);

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
      this.adapter.setPhase(FLOW_LOBBY);

      // Lobby phase: race start vs leave
      const lobbyResult = await Promise.race([
        this.adapter.awaitStart().then((config) => ({ outcome: "start" as const, config })),
        this.adapter.awaitLeave().then(() => ({ outcome: "leave" as const, config: null })),
      ]);

      if (lobbyResult.outcome === "leave") {
        this.adapter.setSession(null);
        this.adapter.setPhase(FLOW_SPLASH);
        return;
      }

      // TODO(roster-factory-interface): legacy IGameConnection path — use start() + rosterFactory for new flows

      this.adapter.setPhase(FLOW_GAME);

      // Sync engine phase changes to adapter
      session.events.on(GAME_PAUSED,  () => this.adapter.setPhase(FLOW_PAUSED));
      session.events.on(GAME_RESUMED, () => this.adapter.setPhase(FLOW_GAME));

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
        session.events.on(GAME_STARTED, ({ pickOrder }) => {
          aiPlayer.startGame(pickOrder.map((p) => p.id));
        });
        session.events.on(ROUND_STARTED, ({ round }) => {
          const cardIds = round.deal.snapshot().map((s) => s.cardId) as [CardId, CardId, CardId, CardId];
          aiPlayer.beginRound(cardIds);
          soloConn.notifyRoundStarted();
        });
      }

      // Engine drives all rounds via SeedProvider
      session.startGame();

      // Relay local moves to peer
      const localId = connection.peerIdentifiers.me;
      const off1 = session.events.on(PICK_MADE,    (e) => { if (e.player.id === localId) this.connectionManager!.sendPick(e.player.id, e.cardId); });
      const off2 = session.events.on(PLACE_MADE,   (e) => { if (e.player.id === localId) this.connectionManager!.sendPlace(e.player.id, e.x, e.y, e.direction); });
      const off3 = session.events.on(DISCARD_MADE, (e) => { if (e.player.id === localId) this.connectionManager!.sendDiscard(e.player.id); });

      // Feed remote moves into engine
      void this.relayRemoteMoves(session, connection);

      await waitForEvent(session.events, GAME_ENDED);
      off1(); off2(); off3();
      this.adapter.setPhase(FLOW_ENDED);
    } catch (e) {
      console.error(e);
      this.adapter.setSession(null);
      this.adapter.setPhase(FLOW_SPLASH);
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

