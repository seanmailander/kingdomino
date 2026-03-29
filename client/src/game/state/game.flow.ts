import { chooseOrderFromSeed, getNextFourCards } from "kingdomino-engine";
import { CommitmentSeedProvider, RandomSeedProvider } from "kingdomino-commitment";
import type { CommitmentTransport } from "kingdomino-commitment";
import type { SeedProvider } from "kingdomino-engine";
import { ConnectionManager } from "./ConnectionManager";
import { GameSession, Player } from "kingdomino-engine";
import type { GameEventBus, GameEvent, CardId } from "kingdomino-engine";
import type { WireMessage, WireMessagePayload, WireMessageType } from "./game.messages";
import { PLACE } from "./game.messages";
import { SoloConnection } from "./connection.solo";
import { RandomAIPlayer } from "./ai.player";
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
  shouldContinuePlaying?: (completedRounds: number, remainingDeck: readonly number[]) => boolean;
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
  private remainingDeck?: number[];
  private aiPlayer: RandomAIPlayer | null = null;
  private soloConnection: SoloConnection | null = null;
  private readonly adapter: FlowAdapter;
  private readonly createConnectionManager: (connection: IGameConnection) => ConnectionManager;
  private readonly createSeedProvider: ((connection: IGameConnection) => SeedProvider) | undefined;
  private readonly shouldContinuePlaying: (
    completedRounds: number,
    remainingDeck: readonly number[],
  ) => boolean;
  private readonly variant: GameVariant;
  private readonly bonuses: GameBonuses;

  constructor(options: LobbyFlowOptions) {
    this.adapter = options.adapter;
    this.createConnectionManager =
      options.createConnectionManager ??
      ((connection) => new ConnectionManager(connection.send, connection.waitFor));
    this.createSeedProvider = options.createSeedProvider;
    this.shouldContinuePlaying =
      options.shouldContinuePlaying ?? ((_, remainingDeck) => remainingDeck.length > 0);
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

  private async handleLocalPauseRequest() {
    if (this.adapter.getPhase() !== "game") return;
    this.connectionManager!.sendPauseRequest();
    try {
      await this.connectionManager!.waitForPauseAck(CONTROL_TIMEOUT_MS);
    } catch {
      return; // Peer didn't ack in time — stay in Game, loop continues
    }
    this.adapter.setPhase("paused");
  }

  private handleIncomingPauseRequest() {
    if (this.adapter.getPhase() === "paused") {
      this.connectionManager!.sendPauseAck();
      return;
    }
    if (this.adapter.getPhase() !== "game") return;
    this.connectionManager!.sendPauseAck();
    this.adapter.setPhase("paused");
  }

  private async handleLocalResumeRequest() {
    if (this.adapter.getPhase() !== "paused") return;
    this.connectionManager!.sendResumeRequest();
    try {
      await this.connectionManager!.waitForResumeAck(CONTROL_TIMEOUT_MS);
    } catch {
      return; // Peer didn't ack in time — stay paused, loop continues
    }
    this.adapter.setPhase("game");
  }

  private handleIncomingResumeRequest() {
    if (this.adapter.getPhase() !== "paused") return;
    this.connectionManager!.sendResumeAck();
    this.adapter.setPhase("game");
  }

  private handleIncomingExitRequest() {
    this.connectionManager!.sendExitAck();
    this.adapter.reset();
  }

  private async listenForControlMessages() {
    // Each loop iteration creates new waitFor promises. When Promise.race resolves one,
    // the other two remain pending until the connection is destroyed (which rejects them).
    // This is safe: connection's resolver map handles multiple concurrent waiters per type,
    // and each handler guards against wrong room state before acting.
    try {
      while (this.adapter.getPhase() === "game" || this.adapter.getPhase() === "paused") {
        await Promise.race([
          this.connectionManager!.waitForPauseRequest().then(() => this.handleIncomingPauseRequest()),
          this.connectionManager!.waitForResumeRequest().then(() => this.handleIncomingResumeRequest()),
          this.connectionManager!.waitForExitRequest().then(() => this.handleIncomingExitRequest()),
          this.adapter.awaitPause().then(() => this.handleLocalPauseRequest()),
          this.adapter.awaitResume().then(() => this.handleLocalResumeRequest()),
        ]);
      }
    } catch {
      // Connection destroyed or flow ended — stop silently
    }
  }

  private async playRound(seedProvider: SeedProvider) {
    const { session, connectionManager } = this;
    if (!session || !connectionManager) throw new Error("LobbyFlow: no active game");

    const trustedSeed = await seedProvider.nextSeed();
    const { next: cardIds, remaining } = getNextFourCards(
      trustedSeed,
      this.remainingDeck ? this.remainingDeck : undefined,
    );
    this.remainingDeck = remaining;

    session.beginRound(cardIds as [CardId, CardId, CardId, CardId]);
    this.aiPlayer?.beginRound(cardIds as [CardId, CardId, CardId, CardId]);
    this.soloConnection?.notifyRoundStarted();

    // Process actors sequentially until the round is complete
    while (session.currentRound !== null) {
      const round = session.currentRound;
      const actor = round.currentActor;
      if (!actor) break;

      if (actor.id === session.myPlayer()?.id) {
        const pickOrPause = await Promise.race([
          waitForEvent(session.events, "pick:made", (e) => e.player.id === actor.id)
            .then((r) => ({ type: "pick" as const, r })),
          this.adapter.oncePhaseIsNot("game").then(() => ({ type: "inactive" as const })),
        ]);
        if (pickOrPause.type === "inactive") return;
        connectionManager.sendPick(actor.id, pickOrPause.r.cardId);

        const placeOrPause = await Promise.race([
          waitForEvent(session.events, "place:made", (e) => e.player.id === actor.id)
            .then((r) => ({ type: "place" as const, r })),
          waitForEvent(session.events, "discard:made", (e) => e.player.id === actor.id)
            .then((r) => ({ type: "discard" as const, r })),
          this.adapter.oncePhaseIsNot("game").then(() => ({ type: "inactive" as const })),
        ]);
        if (placeOrPause.type === "inactive") return;

        if (placeOrPause.type === "discard") {
          connectionManager.sendDiscard(actor.id);
        } else {
          const placeEvent = placeOrPause.r;
          connectionManager.sendPlace(actor.id, placeEvent.x, placeEvent.y, placeEvent.direction);
        }
      } else {
        // waitForPickAndPlacement pre-registers all handlers before the first await,
        // so we only yield ONCE to get pick+place together — React batches them in one render.
        const moveOrEnded = await Promise.race([
          connectionManager.waitForPickAndPlacement(),
          this.adapter.oncePhaseIsNot("game").then((): null => null),
        ]);
        if (!moveOrEnded) return;

        // Apply pick + place/discard atomically so React batches them into one render
        session.handlePick(moveOrEnded.pick.playerId, moveOrEnded.pick.cardId);
        if (moveOrEnded.place.type === PLACE) {
          session.handlePlacement(
            moveOrEnded.place.playerId,
            moveOrEnded.place.x,
            moveOrEnded.place.y,
            moveOrEnded.place.direction,
          );
        } else {
          session.handleDiscard(moveOrEnded.place.playerId);
        }
      }
    }
  }

  private async runFlow(connection: IGameConnection, seedProviderOverride?: SeedProvider) {
    const seedProvider = seedProviderOverride
      ?? this.createSeedProvider?.(connection)
      ?? new CommitmentSeedProvider(connection as unknown as CommitmentTransport);

    this.session = new GameSession({ variant: this.variant, bonuses: this.bonuses, localPlayerId: connection.peerIdentifiers.me });
    this.connectionManager = this.createConnectionManager(connection);

    try {
      this.session.addPlayer(new Player(connection.peerIdentifiers.me));
      this.session.addPlayer(new Player(connection.peerIdentifiers.them));
      this.adapter.setSession(this.session);
      this.adapter.setPhase("lobby");

      // Wait for "Start game" or "Leave game" from the Lobby UI — whichever fires first.
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

      // Start listening for control messages immediately — before any async work
      void this.listenForControlMessages();

      // Determine first-round pick order from a shared cryptographic seed
      const firstSeed = await seedProvider.nextSeed();
      const orderedIds = chooseOrderFromSeed(firstSeed, [connection.peerIdentifiers.me, connection.peerIdentifiers.them]);
      const pickOrder = orderedIds.map((id) => this.session!.playerById(id)!);

      this.session.startGame();
      this.session.setPickOrder(pickOrder);
      this.aiPlayer?.startGame(orderedIds);

      // Play rounds until the deck is exhausted or the game is paused/exited
      let completedRounds = 0;
      while (this.adapter.getPhase() === "game" || this.adapter.getPhase() === "paused") {
        if (this.adapter.getPhase() === "paused") {
          // Suspended: wait for listenForControlMessages to resume or exit
          await this.adapter.oncePhaseIsNot("paused");
          continue;
        }
        await this.playRound(seedProvider);
        if (this.adapter.getPhase() !== "game") continue; // Paused or exited mid-round
        completedRounds += 1;
        if (
          !this.remainingDeck?.length ||
          !this.shouldContinuePlaying(completedRounds, this.remainingDeck)
        ) break;
      }

      if (this.adapter.getPhase() === "game") {
        this.session.endGame();
        this.adapter.setPhase("ended");
      }
    } catch (e) {
      // Connection error — reset to Splash
      console.error(e);
      this.adapter.setSession(null);
      this.adapter.setPhase("splash");
    } finally {
      connection.destroy();
      this.aiPlayer = null;
      this.soloConnection = null;
      this.session = null;
      this.connectionManager = null;
      this.remainingDeck = [];
      this.isRunning = false;
    }
  }
}

