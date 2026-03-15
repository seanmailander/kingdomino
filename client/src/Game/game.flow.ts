import type { AnyAction } from "@reduxjs/toolkit";
import type { RootState } from "../App/reducer";

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
import { getMyPlayerId } from "./game.slice";
import { buildTrustedSeed, MOVE, moveMessage } from "./game.messages";
import {
  getPickOrder,
  myPick,
  myPlace,
  roundEnd,
  roundStart,
  theirPick,
  theirPlace,
  whoseTurn,
} from "./round.slice";
import newSoloConnection from "./connection.solo";
import type { MovePayload } from "./types";

type AppDispatch = (action: AnyAction | ((dispatch: AppDispatch, getState: AppGetState) => unknown)) => unknown;
type AppGetState = () => RootState;

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

async function waitForState(
  getState: AppGetState,
  predicate: (state: RootState) => boolean,
  timeoutMs = 0,
) {
  const startedAt = Date.now();

  while (true) {
    if (predicate(getState())) {
      return;
    }

    if (timeoutMs > 0 && Date.now() - startedAt >= timeoutMs) {
      throw new Error("Timed out waiting for game state update");
    }

    await sleep(30);
  }
}

function getMostRecentPlacement(state: RootState, playerId: string): Omit<MovePayload, "playerId"> {
  const placements = state.game.cardsPlacedByPlayer[playerId] ?? [];
  return placements[placements.length - 1];
}

async function playRound(
  dispatch: AppDispatch,
  getState: AppGetState,
  sendGameMessage: (message: { type: string; content?: unknown }) => void,
  waitForGameMessage: <T = unknown>(messageType: string) => Promise<T>,
  currentDeck?: number[],
) {
  // Round started
  dispatch(roundStart());

  // Deal out some cards
  const trustedSeed = await buildTrustedSeed(sendGameMessage, waitForGameMessage);
  // - each 4-draw, recommit and re-shuffle
  //   - important to re-randomize every turn, or future knowledge will help mis-behaving clients
  const { next, remaining } = getNextFourCards(trustedSeed, currentDeck);

  // Put those cards on the screen
  dispatch(deckShuffled(next));
  dispatch(whoseTurn());

  while (true) {
    // Whose turn?
    const pickOrder = getPickOrder(getState());
    if (pickOrder.length === 0) {
      // No turns left
      dispatch(roundEnd());
      break;
    }

    const playerId = getMyPlayerId(getState()) as string;
    const isMyTurn = pickOrder[0] === playerId;

    if (isMyTurn) {
      const turnCountBeforePlace = pickOrder.length;
      dispatch(myPick());

      await waitForState(getState, (state) => state.round.cardToPlace !== undefined);
      dispatch(myPlace());

      await waitForState(
        getState,
        (state) => getPickOrder(state).length < turnCountBeforePlace,
      );

      const placed = getMostRecentPlacement(getState(), playerId);
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
      dispatch(theirPick());
      const { move } = await waitForGameMessage<{ move: MovePayload }>(MOVE);

      dispatch(cardPicked(move.card));
      dispatch(theirPlace());
      dispatch(cardPlaced(move));
    }
  }

  return remaining;
}

let isSoloGameRunning = false;

export const startSoloGameFlow = () => async (dispatch: AppDispatch, getState: AppGetState) => {
  if (isSoloGameRunning) {
    return;
  }

  isSoloGameRunning = true;
  const { destroy, peerIdentifiers, sendGameMessage, waitForGameMessage } = newSoloConnection();

  try {
    dispatch(startSolo());
    dispatch(playerJoined({ playerId: peerIdentifiers.me, isMe: true }));
    dispatch(playerJoined({ playerId: peerIdentifiers.them, isMe: false }));

    await waitForState(getState, (state) => state.app.room === "Game");

    // Work out who goes first
    // Get a shared seed so its random who goes first
    const firstSeed = await buildTrustedSeed(sendGameMessage, waitForGameMessage);
    // Now use that seed to sort the peer identifiers
    dispatch(orderChosen(chooseOrderFromSeed(firstSeed, peerIdentifiers)));

    // First round!
    let remainingDeck = await playRound(dispatch, getState, sendGameMessage, waitForGameMessage);

    // Subsequent rounds
    while (remainingDeck.length > 0) {
      remainingDeck = await playRound(
        dispatch,
        getState,
        sendGameMessage,
        waitForGameMessage,
        remainingDeck,
      );
    }

    dispatch(gameEnded());
  } catch (error) {
    dispatch(connectionErrored());
  } finally {
    destroy();
    isSoloGameRunning = false;
  }
};

export const startMultiplayerGameFlow = () => (dispatch: AppDispatch) => {
  dispatch(startMulti());
};