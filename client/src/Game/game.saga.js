import { race, call, put, take, takeLatest } from "redux-saga/effects";
import {
  connectionReset,
  connectionErrored,
  gameStarted,
  orderChosen,
  playerJoined,
  gameEnded,
  startMulti,
  startSolo,
} from "./game.actions";

import { chooseOrderFromSeed } from "./gamelogic/utils";

import findOtherPlayers, { newConnection } from "./connection.saga";
import newSoloConnection from "./connection.solo.saga";
import roundSaga from "./round.saga";
import {
  startMessage,
  buildTrustedSeed,
  START,
  COMMITTMENT,
  REVEAL,
  MOVE,
} from "./game.messages";

function* chooseOrder(peerIdentifiers, sendGameMessage, onCommit, onReveal) {
  // Get a shared seed so its random who goes first
  const firstSeed = yield call(
    buildTrustedSeed,
    sendGameMessage,
    onCommit,
    onReveal
  );

  // Now use that seed to sort the peer identifiers
  const choosenOrder = chooseOrderFromSeed(firstSeed, peerIdentifiers);
  yield put(orderChosen(choosenOrder));
}

function* newGame(
  peerIdentifiers,
  sendGameMessage,
  onCommit,
  onReveal,
  onMove
) {
  // Work out who goes first
  yield call(chooseOrder, peerIdentifiers, sendGameMessage, onCommit, onReveal);

  // First round!
  let remainingDeck = yield call(
    roundSaga,
    sendGameMessage,
    onCommit,
    onReveal,
    onMove
  );
  // Subsequent rounds
  while (remainingDeck.length > 0) {
    remainingDeck = yield call(
      roundSaga,
      sendGameMessage,
      onCommit,
      onReveal,
      onMove,
      remainingDeck
    );
  }

  yield put(gameEnded());
}

function* newMultiplayerGame() {
  let disposeUnderlyingConnection;
  try {
    // TODO: make peerfinding a saga so we can control the bheavior for multiple peers
    // TODO: make peerfinding a saga so we get close/error/timeout etc first-class
    // const {
    //   destroy,
    //   peerIdentifiers,
    //   sendGameMessage,
    //   waitForGameMessage,
    // } = yield call(connectionSaga);
    const { playerId, peerConnection } = yield call(newConnection);
    yield put(playerJoined({ playerId, isMe: true }));
    const result = yield call(findOtherPlayers, peerConnection);
    const {
      destroy,
      peerIdentifiers,
      sendGameMessage,
      waitForGameMessage,
    } = result;
    disposeUnderlyingConnection = destroy;
    // TODO: replace the fake "other" player with a real entity
    yield put(playerJoined({ playerId: peerIdentifiers.them, isMe: false }));

    const onStart = yield call(waitForGameMessage, START);
    const onMove = yield call(waitForGameMessage, MOVE);
    const onCommit = yield call(waitForGameMessage, COMMITTMENT);
    const onReveal = yield call(waitForGameMessage, REVEAL);

    // Given a valid connection, let multiple games occur
    while (true) {
      // When the first player starts the game, send it to other players
      const { me, them } = yield race({
        me: take(gameStarted),
        them: take(onStart),
      });
      if (them) {
        yield put(gameStarted());
      }
      yield call(sendGameMessage, startMessage());

      yield call(
        newGame,
        peerIdentifiers,
        sendGameMessage,
        onCommit,
        onReveal,
        onMove
      );
    }
  } catch (error) {
    console.error("Game error", error);
    yield put(connectionErrored(error.message));
  } finally {
    if (disposeUnderlyingConnection) {
      disposeUnderlyingConnection();
    }
  }
}

function* newSoloGame() {
  const result = yield call(newSoloConnection);
  const {
    destroy,
    peerIdentifiers,
    sendGameMessage,
    waitForGameMessage,
  } = result;

  yield put(playerJoined({ playerId: peerIdentifiers.me, isMe: true }));
  yield put(playerJoined({ playerId: peerIdentifiers.them, isMe: false }));

  const onMove = yield call(waitForGameMessage, MOVE);
  const onCommit = yield call(waitForGameMessage, COMMITTMENT);
  const onReveal = yield call(waitForGameMessage, REVEAL);

  // When the first player starts the game, send it to other players
  yield take(gameStarted);

  yield call(
    newGame,
    peerIdentifiers,
    sendGameMessage,
    onCommit,
    onReveal,
    onMove
  );
}

function* gameSaga() {
  // yield takeLatest(startMulti, newMultiplayerGame);
  yield takeLatest(startSolo, newSoloGame);
}

export default gameSaga;
