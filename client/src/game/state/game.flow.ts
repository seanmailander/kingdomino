import { chooseOrderFromSeed, getNextFourCards } from "../gamelogic/utils";
import { ConnectionManager } from "./ConnectionManager";
import { GameSession, Player } from "./GameSession";
import type { GameEventBus, GameEventMap, CardId } from "./GameSession";
import type { GameMessage, GameMessagePayload, GameMessageType } from "./game.messages";
import { SoloConnection } from "./connection.solo";
import { RandomAIPlayer } from "./ai.player";
import {
  setCurrentSession,
  setRoom,
  getRoom,
  onceRoomIsNot,
  awaitLobbyStart,
  awaitLobbyLeave,
  awaitPauseIntent,
  awaitResumeIntent,
  resetAppState,
} from "../../App/store";
import { Lobby, Game, Splash, GamePaused } from "../../App/AppExtras";
import type { GameVariant } from "../gamelogic/cards";
import type { GameBonuses } from "./GameSession";

const CONTROL_TIMEOUT_MS = 5000;

// ── Connection interface ───────────────────────────────────────────────────────

export interface IGameConnection {
  readonly peerIdentifiers: { me: string; them: string };
  send: (message: GameMessage) => void;
  waitFor: <T extends GameMessageType>(messageType: T) => Promise<GameMessagePayload<T>>;
  destroy: () => void;
}

type LobbyFlowOptions = {
  createConnectionManager?: (connection: IGameConnection) => ConnectionManager;
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
function waitForEvent<K extends keyof GameEventMap>(
  bus: GameEventBus,
  event: K,
  predicate?: (data: GameEventMap[K]) => boolean,
): Promise<GameEventMap[K]> {
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
  private readonly createConnectionManager: (connection: IGameConnection) => ConnectionManager;
  private readonly shouldContinuePlaying: (
    completedRounds: number,
    remainingDeck: readonly number[],
  ) => boolean;
  private readonly variant: GameVariant;
  private readonly bonuses: GameBonuses;

  constructor(options: LobbyFlowOptions = {}) {
    this.createConnectionManager =
      options.createConnectionManager ??
      ((connection) => new ConnectionManager(connection.send, connection.waitFor));
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
    this.aiPlayer = new RandomAIPlayer("them", "me", this.variant);
    this.ready(new SoloConnection(this.aiPlayer));
  }

  ReadyMultiplayer() {
    // Multiplayer transport wiring is not implemented yet.
    // Keep this as a safe no-op until a transport is configured.
    setCurrentSession(null);
    setRoom(Splash);
  }

  private async handleLocalPauseRequest() {
    if (getRoom() !== Game) return;
    this.connectionManager!.sendPauseRequest();
    try {
      await this.connectionManager!.waitForPauseAck(CONTROL_TIMEOUT_MS);
    } catch {
      return; // Peer didn't ack in time — stay in Game, loop continues
    }
    setRoom(GamePaused);
  }

  private handleIncomingPauseRequest() {
    if (getRoom() === GamePaused) {
      this.connectionManager!.sendPauseAck();
      return;
    }
    if (getRoom() !== Game) return;
    this.connectionManager!.sendPauseAck();
    setRoom(GamePaused);
  }

  private async handleLocalResumeRequest() {
    if (getRoom() !== GamePaused) return;
    this.connectionManager!.sendResumeRequest();
    try {
      await this.connectionManager!.waitForResumeAck(CONTROL_TIMEOUT_MS);
    } catch {
      return; // Peer didn't ack in time — stay paused, loop continues
    }
    setRoom(Game);
  }

  private handleIncomingResumeRequest() {
    if (getRoom() !== GamePaused) return;
    this.connectionManager!.sendResumeAck();
    setRoom(Game);
  }

  private handleIncomingExitRequest() {
    this.connectionManager!.sendExitAck();
    resetAppState();
  }

  private async listenForControlMessages() {
    // Each loop iteration creates new waitFor promises. When Promise.race resolves one,
    // the other two remain pending until the connection is destroyed (which rejects them).
    // This is safe: connection's resolver map handles multiple concurrent waiters per type,
    // and each handler guards against wrong room state before acting.
    try {
      while (getRoom() === Game || getRoom() === GamePaused) {
        await Promise.race([
          this.connectionManager!.waitForPauseRequest().then(() => this.handleIncomingPauseRequest()),
          this.connectionManager!.waitForResumeRequest().then(() => this.handleIncomingResumeRequest()),
          this.connectionManager!.waitForExitRequest().then(() => this.handleIncomingExitRequest()),
          awaitPauseIntent().then(() => this.handleLocalPauseRequest()),
          awaitResumeIntent().then(() => this.handleLocalResumeRequest()),
        ]);
      }
    } catch {
      // Connection destroyed or flow ended — stop silently
    }
  }

  private async playRound() {
    const { session, connectionManager } = this;
    if (!session || !connectionManager) throw new Error("LobbyFlow: no active game");

    const trustedSeed = await connectionManager.buildTrustedSeed();
    const { next: cardIds, remaining } = getNextFourCards(
      trustedSeed,
      this.remainingDeck ? this.remainingDeck : undefined,
    );
    this.remainingDeck = remaining;

    session.beginRound(cardIds as [CardId, CardId, CardId, CardId]);
    this.aiPlayer?.beginRound(cardIds as [CardId, CardId, CardId, CardId]);

    // Process actors sequentially until the round is complete
    while (session.currentRound !== null) {
      const round = session.currentRound;
      const actor = round.currentActor;
      if (!actor) break;

      if (actor.isLocal) {
        const pickOrPause = await Promise.race([
          waitForEvent(session.events, "pick:made", (e) => e.player.id === actor.id)
            .then((r) => ({ type: "pick" as const, r })),
          onceRoomIsNot(Game).then(() => ({ type: "inactive" as const })),
        ]);
        if (pickOrPause.type === "inactive") return;

        const placeOrPause = await Promise.race([
          waitForEvent(session.events, "place:made", (e) => e.player.id === actor.id)
            .then((r) => ({ type: "place" as const, r })),
          onceRoomIsNot(Game).then(() => ({ type: "inactive" as const })),
        ]);
        if (placeOrPause.type === "inactive") return;

        // Send move to peer
        const placeEvent = placeOrPause.r;
        connectionManager.sendMove({
          playerId: actor.id,
          card: placeEvent.cardId,
          x: placeEvent.x,
          y: placeEvent.y,
          direction: placeEvent.direction,
        });
      } else {
        const moveOrPause = await Promise.race([
          connectionManager.waitForMove().then(
            (r) => ({ type: "move" as const, r }),
            () => ({ type: "inactive" as const }),
          ),
          onceRoomIsNot(Game).then(() => ({ type: "inactive" as const })),
        ]);
        if (moveOrPause.type === "inactive") return;

        const { move } = moveOrPause.r;
        session.handlePick(move.playerId, move.card);
        session.handlePlacement(move.playerId, move.x, move.y, move.direction);
      }
    }
  }

  private async runFlow(connection: IGameConnection) {
    this.session = new GameSession({ variant: this.variant, bonuses: this.bonuses });
    this.connectionManager = this.createConnectionManager(connection);

    try {
      this.session.addPlayer(new Player(connection.peerIdentifiers.me, true));
      this.session.addPlayer(new Player(connection.peerIdentifiers.them, false));
      setCurrentSession(this.session);
      setRoom(Lobby);

      // Wait for "Start game" or "Leave game" from the Lobby UI — whichever fires first.
      const lobbyResult = await Promise.race([
        awaitLobbyStart().then(() => "start" as const),
        awaitLobbyLeave().then(() => "leave" as const),
      ]);

      if (lobbyResult === "leave") {
        setCurrentSession(null);
        setRoom("Splash");
        return;
      }

      setRoom(Game);

      // Start listening for control messages immediately — before any async work
      void this.listenForControlMessages();

      // Determine first-round pick order from a shared cryptographic seed
      const firstSeed = await this.connectionManager.buildTrustedSeed();
      const orderedIds = chooseOrderFromSeed(firstSeed, connection.peerIdentifiers);
      const pickOrder = orderedIds.map((id) => this.session!.playerById(id)!);

      this.session.startGame(pickOrder);
      this.aiPlayer?.startGame(orderedIds);

      // Play rounds until the deck is exhausted or the game is paused/exited
      let completedRounds = 0;
      while (getRoom() === Game || getRoom() === GamePaused) {
        if (getRoom() === GamePaused) {
          // Suspended: wait for listenForControlMessages to resume or exit
          await onceRoomIsNot(GamePaused);
          continue;
        }
        await this.playRound();
        if (getRoom() !== Game) continue; // Paused or exited mid-round
        completedRounds += 1;
        if (
          !this.remainingDeck?.length ||
          !this.shouldContinuePlaying(completedRounds, this.remainingDeck)
        ) break;
      }

      if (getRoom() === Game) {
        this.session.endGame();
      }
    } catch (e) {
      // Connection error — reset to Splash
      console.error(e);
      setCurrentSession(null);
      setRoom("Splash");
    } finally {
      connection.destroy();
      this.aiPlayer = null;
      this.session = null;
      this.connectionManager = null;
      this.remainingDeck = [];
      this.isRunning = false;
    }
  }
}

export const gameLobby = new LobbyFlow();
