import { effect } from "alien-signals";

import { createGameSignal, createGameSignalNoPayload, gameStore, selectComputed } from "../App/store";
import { App as AppState } from "../App/app.slice";

import {
  cardPicked,
  cardPlaced,
  connectionErrored,
  deckShuffled,
  gameEnded,
  orderChosen,
  playerJoined,
  startMulti,
  startSolo,
} from "./game.actions";
import { chooseOrderFromSeed, getNextFourCards } from "./gamelogic/utils";
import { Game } from "./state/game.slice";
import { buildTrustedSeed, MOVE, moveMessage } from "./game.messages";
import Round from "./state/Round";
import newSoloConnection from "./connection.solo";
import type { MovePayload } from "./types";

async function waitForComputed(predicate: () => boolean, timeoutMs = 0) {
  return new Promise<void>((resolve, reject) => {
    let settled = false;

    const timeoutHandle =
      timeoutMs > 0
        ? setTimeout(() => {
            if (settled) {
              return;
            }

            settled = true;
            cleanup?.();
            reject(new Error("Timed out waiting for game state update"));
          }, timeoutMs)
        : undefined;

    const cleanup = effect(() => {
      if (settled) {
        return;
      }

      if (predicate()) {
        settled = true;
        if (timeoutHandle) {
          clearTimeout(timeoutHandle);
        }
        queueMicrotask(() => cleanup?.());
        resolve();
      }
    });
  });
}

function getMostRecentPlacement(playerId: string): Omit<MovePayload, "playerId"> {
  const placements = gameStore.state().app.game.cardsPlacedByPlayer[playerId] ?? [];
  return placements[placements.length - 1];
}

const signalRoundStart = createGameSignalNoPayload(Round.roundStart);
const signalRoundWhoseTurn = createGameSignalNoPayload(Round.whoseTurn);
const signalRoundEnd = createGameSignalNoPayload(Round.roundEnd);
const signalRoundMyPick = createGameSignalNoPayload(Round.myPick);
const signalRoundMyPlace = createGameSignalNoPayload(Round.myPlace);
const signalRoundTheirPick = createGameSignalNoPayload(Round.theirPick);
const signalRoundTheirPlace = createGameSignalNoPayload(Round.theirPlace);
const signalDeckShuffled = createGameSignal(deckShuffled);
const signalCardPicked = createGameSignal(cardPicked);
const signalCardPlaced = createGameSignal(cardPlaced);
const signalStartSolo = createGameSignalNoPayload(startSolo);
const signalPlayerJoined = createGameSignal(playerJoined);
const signalOrderChosen = createGameSignal(orderChosen);
const signalGameEnded = createGameSignalNoPayload(gameEnded);
const signalConnectionErrored = createGameSignalNoPayload(connectionErrored);
const signalStartMulti = createGameSignalNoPayload(startMulti);

const pickOrderComputed = selectComputed((state) => Game.fromSelectorState(state).pickOrder());
const myPlayerIdComputed = selectComputed((state) => Game.fromSelectorState(state).myPlayerId());
const roomComputed = selectComputed((state) => AppState.fromSelectorState(state).room());
const cardToPlaceComputed = selectComputed((state) => Game.fromSelectorState(state).cardToPlace());

async function playRound(
  sendGameMessage: (message: { type: string; content?: unknown }) => void,
  waitForGameMessage: <T = unknown>(messageType: string) => Promise<T>,
  currentDeck?: number[],
) {
  // Round started
  signalRoundStart();

  // Deal out some cards
  const trustedSeed = await buildTrustedSeed(sendGameMessage, waitForGameMessage);
  // - each 4-draw, recommit and re-shuffle
  //   - important to re-randomize every turn, or future knowledge will help mis-behaving clients
  const { next, remaining } = getNextFourCards(trustedSeed, currentDeck);

  // Put those cards on the screen
  signalDeckShuffled(next);
  signalRoundWhoseTurn();

  while (true) {
    // Whose turn?
    const pickOrder = pickOrderComputed();
    if (pickOrder.length === 0) {
      // No turns left
      signalRoundEnd();
      break;
    }

    const playerId = myPlayerIdComputed() as string;
    const isMyTurn = pickOrder[0] === playerId;

    if (isMyTurn) {
      const turnCountBeforePlace = pickOrder.length;
      signalRoundMyPick();

      await waitForComputed(() => cardToPlaceComputed() !== undefined);
      signalRoundMyPlace();

      await waitForComputed(() => pickOrderComputed().length < turnCountBeforePlace);

      const placed = getMostRecentPlacement(playerId);
      if (placed) {
        sendGameMessage(
          moveMessage({
            playerId,
            card: placed.card,
            x: placed.x,
            y: placed.y,
            direction: placed.direction,
          }),
        );
      }
    } else {
      signalRoundTheirPick();
      const { move } = await waitForGameMessage<{ move: MovePayload }>(MOVE);

      signalCardPicked(move.card);
      signalRoundTheirPlace();
      signalCardPlaced(move);
    }
  }

  return remaining;
}

let isSoloGameRunning = false;

export const startSoloGameFlow = async () => {
  if (isSoloGameRunning) {
    return;
  }

  isSoloGameRunning = true;
  const { destroy, peerIdentifiers, sendGameMessage, waitForGameMessage } = newSoloConnection();

  try {
    signalStartSolo();
    signalPlayerJoined({ playerId: peerIdentifiers.me, isMe: true });
    signalPlayerJoined({ playerId: peerIdentifiers.them, isMe: false });

    await waitForComputed(() => roomComputed() === "Game");

    // Work out who goes first
    // Get a shared seed so its random who goes first
    const firstSeed = await buildTrustedSeed(sendGameMessage, waitForGameMessage);
    // Now use that seed to sort the peer identifiers
    signalOrderChosen(chooseOrderFromSeed(firstSeed, peerIdentifiers));

    // First round!
    let remainingDeck = await playRound(sendGameMessage, waitForGameMessage);

    // Subsequent rounds
    while (remainingDeck.length > 0) {
      remainingDeck = await playRound(sendGameMessage, waitForGameMessage, remainingDeck);
    }

    signalGameEnded();
  } catch {
    signalConnectionErrored();
  } finally {
    destroy();
    isSoloGameRunning = false;
  }
};

export const startMultiplayerGameFlow = () => {
  signalStartMulti();
};
