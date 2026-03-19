import { chooseOrderFromSeed, getNextFourCards } from "../gamelogic/utils";
import { ConnectionManager } from "./ConnectionManager";
import { GameSession, Player } from "./GameSession";
import type { GameEventBus, GameEventMap, CardId } from "./GameSession";
import type { GameMessage, GameMessagePayload, GameMessageType } from "./game.messages";
import SoloConnection from "./connection.solo";
import { MultiplayerConnection } from "./connection.multiplayer";
import { setCurrentSession, setRoom, awaitLobbyStart, awaitLobbyLeave } from "../../App/store";
import { Lobby, Game } from "../../App/AppExtras";

// ── Connection interface ───────────────────────────────────────────────────────

interface IGameConnection {
  readonly peerIdentifiers: { me: string; them: string };
  send: (message: GameMessage) => void;
  waitFor: <T extends GameMessageType>(messageType: T) => Promise<GameMessagePayload<T>>;
  destroy: () => void;
}

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

  ReadySolo() {
    if (this.isRunning) return;
    this.isRunning = true;
    void this.runFlow(new SoloConnection());
  }

  ReadyMultiplayer() {
    if (this.isRunning) return;
    this.isRunning = true;
    void this.runFlow(new MultiplayerConnection());
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

    // Process actors sequentially until the round is complete
    while (session.currentRound !== null) {
      const round = session.currentRound;
      const actor = round.currentActor;
      if (!actor) break;

      if (actor.isLocal) {
        // Wait for user to pick via Card.tsx (session.handleLocalPick)
        await waitForEvent(session.events, "pick:made", (e) => e.player.id === actor.id);

        // Wait for user to place via BoardArea.tsx (session.handleLocalPlacement)
        const placeEvent = await waitForEvent(
          session.events,
          "place:made",
          (e) => e.player.id === actor.id,
        );

        // Send move to peer
        connectionManager.sendMove({
          playerId: actor.id,
          card: placeEvent.cardId,
          x: placeEvent.x,
          y: placeEvent.y,
          direction: placeEvent.direction,
        });
      } else {
        // Wait for opponent's move from peer
        const { move } = await connectionManager.waitForMove();

        session.handlePick(move.playerId, move.card);
        session.handlePlacement(move.playerId, move.x, move.y, move.direction);
      }
    }
  }

  private async runFlow(connection: IGameConnection) {
    this.session = new GameSession();
    this.connectionManager = new ConnectionManager(connection.send, connection.waitFor);

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

      // Determine first-round pick order from a shared cryptographic seed
      const firstSeed = await this.connectionManager.buildTrustedSeed();
      const orderedIds = chooseOrderFromSeed(firstSeed, connection.peerIdentifiers);
      const pickOrder = orderedIds.map((id) => this.session!.playerById(id)!);

      this.session.startGame(pickOrder);

      // Play all rounds until the deck is exhausted
      do {
        await this.playRound();
      } while (this.remainingDeck?.length);

      this.session.endGame();
    } catch {
      // Connection error — reset to Splash
      setCurrentSession(null);
      setRoom("Splash");
    } finally {
      connection.destroy();
      this.session = null;
      this.connectionManager = null;
      this.remainingDeck = [];
      this.isRunning = false;
    }
  }
}

export const gameLobby = new LobbyFlow();
