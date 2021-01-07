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

function* trustedDeal(sendGameMessage, onCommit, onReveal, currentDeck) {
  const trustedSeed = yield call(
    buildTrustedSeed,
    sendGameMessage,
    onCommit,
    onReveal
  );

  // - each 4-draw, recommit and re-shuffle
  //   - important to re-randomize every turn, or future knowledge will help mis-behaving clients
  const { next, remaining } = getNextFourCards(trustedSeed, currentDeck);
  return { next, remaining };
}

function* roundSaga(sendGameMessage, onCommit, onReveal, onMove, currentDeck) {
  // Round started
  yield put(roundStart());

  // Deal out some cards
  const { next, remaining } = yield call(
    trustedDeal,
    sendGameMessage,
    onCommit,
    onReveal,
    currentDeck
  );

  // Put those cards on the screen
  yield put(deckShuffled(next));

  yield put(whoseTurn());

  while (true) {
    // Whose turn?
    const pickOrder = yield select(getPickOrder);
    if (pickOrder.length === 0) {
      // No turns left
      yield put(roundEnd());
      break;
    }

    const playerId = yield select(getMyPlayerId);
    const isMyTurn = pickOrder[0] === playerId;

    if (isMyTurn) {
      yield put(myPick());

      const { payload: picked } = yield take(cardPicked);
      console.debug(picked);
      yield put(myPlace());
      const { payload: placed } = yield take(cardPlaced);
      console.debug(placed);
      const { card, x, y, direction } = placed;

      const move = {
        playerId,
        card,
        x,
        y,
        direction,
      };

      yield call(sendGameMessage, moveMessage(move));
    } else {
      yield put(theirPick());

      const { move } = yield take(onMove);
      console.debug(move);

      const { playerId: theirPlayerId, card, x, y, direction } = move;
      yield put(cardPicked(card));
      yield put(theirPlace());
      yield put(cardPlaced({ playerId: theirPlayerId, card, x, y, direction }));
    }
  }

  return remaining;
}

export default roundSaga;
