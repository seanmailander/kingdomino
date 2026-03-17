import { chooseOrderFromSeed, getNextFourCards } from "../gamelogic/utils";
import { buildTrustedSeed, MOVE, moveMessage } from "./game.messages";
import { GameSession, Player } from "./GameSession";
import type { GameEventBus, GameEventMap, CardId } from "./GameSession";
import type { Direction } from "./types";
import newSoloConnection from "./connection.solo";
import { setCurrentSession, setRoom, awaitLobbyStart, awaitLobbyLeave } from "../../App/store";
import { Lobby, Game } from "../../App/AppExtras";

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
  return new Promise(resolve => {
    const off = bus.on(event, data => {
      if (!predicate || predicate(data)) {
        off();
        resolve(data);
      }
    });
  });
}

// ── Round loop ─────────────────────────────────────────────────────────────────────

async function playRound(
  session: GameSession,
  sendGameMessage: (message: { type: string; content?: unknown }) => void,
  waitForGameMessage: <T = unknown>(messageType: string) => Promise<T>,
  currentDeck?: number[],
): Promise<number[]> {
  const trustedSeed = await buildTrustedSeed(sendGameMessage, waitForGameMessage);
  const { next: cardIds, remaining } = getNextFourCards(trustedSeed, currentDeck);

  session.beginRound(cardIds as [CardId, CardId, CardId, CardId]);

  // Process actors sequentially until the round is complete
  while (session.currentRound !== null) {
    const round = session.currentRound;
    const actor = round.currentActor;
    if (!actor) break;

    if (actor.isLocal) {
      // Wait for user to pick via Card.tsx (session.handleLocalPick)
      await waitForEvent(session.events, "pick:made", e => e.player.id === actor.id);

      // Wait for user to place via BoardArea.tsx (session.handleLocalPlacement)
      const placeEvent = await waitForEvent(session.events, "place:made", e => e.player.id === actor.id);

      // Send move to peer
      sendGameMessage(
        moveMessage({
          playerId: actor.id,
          card: placeEvent.cardId,
          x: placeEvent.x,
          y: placeEvent.y,
          direction: placeEvent.direction,
        }),
      );
    } else {
      // Wait for opponent's move from peer
      const { move } = await waitForGameMessage<{
        move: { playerId: string; card: number; x: number; y: number; direction: number };
      }>(MOVE);

      session.handlePick(move.playerId, move.card);
      session.handlePlacement(move.playerId, move.x, move.y, move.direction as Direction);
    }
  }

  return remaining;
}

// ── Solo game flow ─────────────────────────────────────────────────────────────────

let isSoloGameRunning = false;

export const startSoloGameFlow = async () => {
  if (isSoloGameRunning) return;
  isSoloGameRunning = true;

  const { destroy, peerIdentifiers, sendGameMessage, waitForGameMessage } = newSoloConnection();
  const session = new GameSession();

  try {
    session.addPlayer(new Player(peerIdentifiers.me, true));
    session.addPlayer(new Player(peerIdentifiers.them, false));
    setCurrentSession(session);
    setRoom(Lobby);

    // Wait for "Start game" button in Lobby UI (triggerLobbyStart)
    await awaitLobbyStart();
    setRoom(Game);

    // Determine first-round pick order from a shared cryptographic seed
    const firstSeed = await buildTrustedSeed(sendGameMessage, waitForGameMessage);
    const orderedIds: string[] = chooseOrderFromSeed(firstSeed, peerIdentifiers);
    const pickOrder = orderedIds.map(id => session.playerById(id)!);

    session.startGame(pickOrder);

    // First round
    let remainingDeck = await playRound(session, sendGameMessage, waitForGameMessage);

    // Subsequent rounds
    while (remainingDeck.length > 0) {
      remainingDeck = await playRound(session, sendGameMessage, waitForGameMessage, remainingDeck);
    }

    session.endGame();
  } catch {
    // Connection error — reset to Splash
    setCurrentSession(null);
    setRoom("Splash");
  } finally {
    destroy();
    isSoloGameRunning = false;
  }
};

export const startMultiplayerGameFlow = () => {
  // Multiplayer P2P not yet implemented — placeholder
  setRoom(Lobby);
};

