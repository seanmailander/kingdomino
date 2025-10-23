import { call, put, take, select } from "redux-saga/effects";
import { getMyPlayerId } from "./game.slice";

import { getNextFourCards } from "./gamelogic/utils";

import { deckShuffled, cardPicked, cardPlaced } from "./game.actions";
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

import { buildTrustedSeed, moveMessage } from "./game.messages";
import { useDispatch } from "react-redux";
import { addListener } from "@reduxjs/toolkit";

const trustedDeal = async (
  sendGameMessage,
  waitForGameMessage,
  currentDeck,
) => {
  const trustedSeed = await buildTrustedSeed(
    sendGameMessage,
    waitForGameMessage,
  );

  // - each 4-draw, recommit and re-shuffle
  //   - important to re-randomize every turn, or future knowledge will help mis-behaving clients
  const { next, remaining } = getNextFourCards(trustedSeed, currentDeck);
  return { next, remaining };
};

export const useRound = async (sendGameMessage, waitForGameMessage, currentDeck) => {
  const dispatch = useDispatch();

  // Round started
  dispatch(roundStart());

  // Deal out some cards
  const { next, remaining } = await trustedDeal(
    sendGameMessage,
    waitForGameMessage,
    currentDeck,
  );

  // Put those cards on the screen
  dispatch(deckShuffled(next));

  dispatch(whoseTurn());

  while (true) {
    // Whose turn?
    const pickOrder = yield select(getPickOrder);
    if (pickOrder.length === 0) {
      // No turns left
      dispatch(roundEnd());
      break;
    }

    const playerId = yield select(getMyPlayerId);
    const isMyTurn = pickOrder[0] === playerId;

    if (isMyTurn) {
      dispatch(myPick());

      // When the first player starts the game, send it to other players
      const unsubscribePicked = dispatch(
        addListener({
          predicate: (action) => true,
          effect: async (action, api) => {
            const { payload: picked } = await api.take(cardPicked.match);
            console.debug(picked);
            dispatch(myPlace());
            dispatch(unsubscribePicked);
          },
        }),
      );

      // When the first player starts the game, send it to other players
      const unsubscribePlaced = dispatch(
        addListener({
          predicate: (action) => true,
          effect: async (action, api) => {
            const { payload: placed } = await api.take(cardPlaced.match);
            console.debug(placed);
            const { card, x, y, direction } = placed;

            const move = {
              playerId,
              card,
              x,
              y,
              direction,
            };

            sendGameMessage(moveMessage(move));
            dispatch(unsubscribePlaced);
          },
        }),
      );
      return;
    }

    dispatch(theirPick());

    // TODO! wait for mesasage
    const { move } = await onMove();

    const { playerId: theirPlayerId, card, x, y, direction } = move;
    dispatch(cardPicked(card));
    dispatch(theirPlace());
    dispatch(cardPlaced({ playerId: theirPlayerId, card, x, y, direction }));
  }

  return remaining;
};
