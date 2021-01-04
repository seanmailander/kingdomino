import { all, race, call, put, take, takeLatest } from "redux-saga/effects";
import {
  connectionReset,
  connectionErrored,
  gameStarted,
  orderChosen,
  playerJoined,
  playerLeft,
  gameEnded,
  deckShuffled,
} from "./game.slice";

import {
  commit,
  verify,
  combine,
  getNextFourCards,
  chooseOrderFromSeed,
} from "./gamelogic/utils";

import newPeerConnection from "./gamelogic/peerConnection";

const START = "START";
const COMMITTMENT = "COMMITTMENT";
const REVEAL = "REVEAL";
const MOVE = "MOVE";

// - A chooses a random number Ra
// - A calculates hash Ha = H(Ra)
// - A shares committment Ha
// - B chooses a random number Rb
// - B calculates hash Hb = H(Rb)
// - B shares committment Hb
// - Both A and B reveal Ra and Rb
// - Both A and B verify committments
// - Both A and B calculate shared random as G = H (Ra || Rb)

const waitForGameStart = async (onStart) => {
  await onStart.next();
};
async function buildTrustedSeed(sendGameMessage, onCommit, onReveal) {
  const { secret: mySecret, committment: myCommittment } = await commit();
  await sendGameMessage({
    type: COMMITTMENT,
    content: { committment: myCommittment },
  });

  const {
    value: { committment: theirCommittment },
  } = await onCommit.next();

  await sendGameMessage({ type: REVEAL, content: { secret: mySecret } });

  const {
    value: { secret: theirSecret },
  } = await onReveal.next();

  await verify(theirSecret, theirCommittment);

  return await combine(mySecret, theirSecret);
}

async function trustedDeal(sendGameMessage, onCommit, onReveal, currentDeck) {
  const trustedSeed = await buildTrustedSeed(
    sendGameMessage,
    onCommit,
    onReveal
  );

  // - each 4-draw, recommit and re-shuffle
  //   - important to re-randomize every turn, or future knowledge will help mis-behaving clients
  const { next, remaining } = getNextFourCards(trustedSeed, currentDeck);
  return { next, remaining };
}

function* newRound(sendGameMessage, onCommit, onReveal, onMove, currentDeck) {
  const { next, remaining } = yield call(
    trustedDeal,
    sendGameMessage,
    onCommit,
    onReveal,
    currentDeck
  );
  yield put(deckShuffled(next));
  // TODO: wait for pick/place
  return remaining;
}

function* chooseOrder(peerIdentifiers, sendGameMessage, onCommit, onReveal) {
  // Get a shared seed so its random who goes first
  const firstSeed = yield call(
    buildTrustedSeed,
    sendGameMessage,
    onCommit,
    onReveal
  );

  // Now use that seed to sort the peer identifiers
  // TODO: make this a saga
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
    newRound,
    sendGameMessage,
    onCommit,
    onReveal,
    onMove
  );
  // Subsequent rounds
  while (remainingDeck.length > 0) {
    remainingDeck = yield call(
      newRound,
      sendGameMessage,
      onCommit,
      onReveal,
      onMove,
      remainingDeck
    );
  }

  yield put(gameEnded());
}

function* newConnections() {
  try {
    // TODO: replace this fake "self" player with a real entity
    yield put(playerJoined({ playerId: -1, isMe: true }));
    // TODO: make peerfinding a saga so we can control the bheavior for multiple peers
    const {
      peerIdentifiers,
      sendGameMessage,
      waitForGameMessage,
    } = yield call(newPeerConnection, { onError: () => {} });
    // TODO: replace this fake "self" player with a real entity
    yield put(playerJoined({ playerId: peerIdentifiers.me, isMe: true }));
    // TODO: remove hte need for this janky fake player without a real identifier
    // ie choose a session UUID and share that via a message
    yield put(playerLeft({ playerId: -1 }));
    // TODO: replace the fake "other" player with a real entity
    yield put(playerJoined({ playerId: peerIdentifiers.them, isMe: false }));

    const onStart = waitForGameMessage(START);
    const onMove = waitForGameMessage(MOVE);
    const onCommit = waitForGameMessage(COMMITTMENT);
    const onReveal = waitForGameMessage(REVEAL);

    // Given a valid connection, let multiple games occur
    while (true) {
      // When the first player starts the game, send it to other players
      yield race({
        me: take(gameStarted),
        them: call(waitForGameStart, onStart),
      });
      yield call(sendGameMessage, { type: START });

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
    yield put(connectionErrored(error.message));
  }
}
function* gameSaga() {
  yield takeLatest(connectionReset, newConnections);
}

export default gameSaga;
