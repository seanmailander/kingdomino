import { call, put, take, takeLatest } from "redux-saga/effects";
import {
  connectionReset,
  connectionErrored,
  gameStarted,
  orderChosen,
  playerJoined,
} from "./game.slice";

import { commit, verify, combine, getNextFourCards } from "./gamelogic/utils";

import newPeerConnection from "./gamelogic/peerConnection";

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
  console.debug("GAME:SEEDED", trustedSeed);

  // - each 4-draw, recommit and re-shuffle
  //   - important to re-randomize every turn, or future knowledge will help mis-behaving clients
  const { next, remaining } = getNextFourCards(trustedSeed, currentDeck);
  console.debug("GAME:DEAL", next);
  return { next, remaining };
}

function* newRound(sendGameMessage, onCommit, onReveal, onMove) {}

function* newGame(sendGameMessage, onCommit, onReveal, onMove) {
  const firstSeed = yield call(
    buildTrustedSeed,
    sendGameMessage,
    onCommit,
    onReveal
  );
  yield put(orderChosen(firstSeed));
}

function* newConnections() {
  try {
    // TODO: replace this fake "self" player with a real entity
    yield put(playerJoined({ playerId: 0, isMe: true }));

    // TODO: make peerfinding a saga so we can control the bheavior for multiple peers
    const {
      sendGameMessage,
      waitForGameMessage,
    } = yield call(newPeerConnection, { onError: () => {} });
    // TODO: replace the fake "other" player with a real entity
    // TODO: get playerId from first secret or something
    yield put(playerJoined({ playerId: 1, isMe: false }));

    //TODO: when the first player starts the game, send it to other players
    yield take(gameStarted);

    const onMove = waitForGameMessage(MOVE);
    const onCommit = waitForGameMessage(COMMITTMENT);
    const onReveal = waitForGameMessage(REVEAL);
    yield call(newGame, sendGameMessage, onCommit, onReveal, onMove);
  } catch (error) {
    yield put(connectionErrored(error.message));
  }
}
function* gameSaga() {
  yield takeLatest(connectionReset, newConnections);
}

export default gameSaga;
