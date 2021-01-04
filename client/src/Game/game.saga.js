import { call, put, takeEvery, takeLatest } from "redux-saga/effects";
import {
  CONNECTION_ERRORED,
  CONNECTION_RESET,
  GAME_STARTED,
} from "./game.slice";

import newPeerConnection from "./gamelogic/peerConnection";


const COMMITTMENT = "COMMITTMENT";
const REVEAL = "REVEAL";
const MOVE = "MOVE";

const initializeGame = ({ sendGameMessage, waitForGameMessage }) => {
  const trustedDeal = async (currentDeck) => {
    const trustedSeed = await buildTrustedSeed(
      sendGameMessage,
      onCommit,
      onReveal
    );
    console.debug("GAME:SEEDED", trustedSeed);

    const { next, remaining } = getNextFourCards(trustedSeed, currentDeck);
    console.debug("GAME:DEAL", next);
    return { next, remaining };
  };

  const makeMove = () => {
    console.debug("GAME:MOVE");
    sendGameMessage("MOVE", { move: "1,2,3,4" });
  };

  return {
    trustedDeal,
    makeMove,
  };
};

function* newConnections() {
  try {
    const { sendGameMessage, waitForGameMessage } = yield call(
      newPeerConnection
    );
    yield put({ type: GAME_STARTED });

    const onMove = waitForGameMessage(MOVE);
    const onCommit = waitForGameMessage(COMMITTMENT);
    const onReveal = waitForGameMessage(REVEAL);


    
  } catch (error) {
    yield put({ type: CONNECTION_ERRORED, error });
  }
}
function* gameSaga() {
  yield takeLatest(CONNECTION_RESET, newConnections);
}

export default gameSaga;
