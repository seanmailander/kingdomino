import {
  all,
  race,
  call,
  put,
  take,
  takeLatest,
  cancel,
  fork,
} from "redux-saga/effects";
import { eventChannel } from "redux-saga";

import { postData } from "./gamelogic/fetch";
import { connectionConnected, connectionErrored } from "./game.slice";

import {
  getPeerIdentifiers,
  newPeerConnection,
} from "./gamelogic/peerConnection";

const joinGameURI = "/api/bootstrap/letMeIn";

function peerConnectionChannel(p) {
  return eventChannel((emit) => {
    // TODO: is this an npm module?

    const signalHandler = (data) => emit(data);
    const errorHandler = (err) => emit(new Error(err));

    // TODO: bubble up errors
    p.on("error", (err) => console.error("ERROR", err));
    p.on("signal", signalHandler);
    p.on("error", errorHandler);

    // the subscriber must return an unsubscribe function
    // this will be invoked when the saga calls `channel.close` method
    const unsubscribe = () => {
      p.off("signal", signalHandler);
      p.off("error", errorHandler);
    };

    return unsubscribe;
  });
}

function makeGameMessageChannel(p) {
  return eventChannel((emit) => {
    // TODO: is this an npm module?

    const dataHandler = (data) => emit(data);
    const errorHandler = (err) => emit(new Error(err));

    // TODO: bubble up errors
    p.on("error", (err) => console.error("ERROR", err));
    p.on("data", dataHandler);
    p.on("error", errorHandler);

    // the subscriber must return an unsubscribe function
    // this will be invoked when the saga calls `channel.close` method
    const unsubscribe = () => {
      p.off("data", dataHandler);
      p.off("error", errorHandler);
    };

    return unsubscribe;
  });
}

const waitForConnection = async (p) => {
  return new Promise((resolve, reject) => {
    p.once("connect", resolve);
  });
};

function waitFor(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function* checkBackIn(timeout, playerId, p) {
  yield call(waitFor, timeout);
  const {
    offer,
    answer,
    checkBackInMs,
    waitForConnection,
  } = yield call(postData, joinGameURI, { playerId });

  yield call(
    handleResponse,
    offer,
    answer,
    checkBackInMs,
    waitForConnection,
    playerId,
    p
  );
}

function handleResponse(
  offer,
  answer,
  checkBackInMs,
  waitForConnection,
  playerId,
  p
) {
  // TODO: handle each of the scenarios
  console.debug(
    "saw response",
    offer,
    answer,
    checkBackInMs,
    waitForConnection
  );

  if (offer) {
    // Recieved an offer
    console.debug("Got an offer, starting a new connection and acknowledging");
    // Throw away my offer, start a new connection and acknowledge
    p.signal(offer);
    return;
  }

  if (answer) {
    // Recieved an answer
    console.debug("Got an answer, setting up connection");
    // Acknowledge with initial connection
    p.signal(answer);
    return;
  }

  if (checkBackInMs) {
    // Was told to wait a little and check back in
    console.debug("Told to wait and try again");
    // So do that
    return checkBackIn(checkBackInMs, playerId, p);
  }

  if (waitForConnection) {
    // Was told wait a little for peer to reach out
    // Sooooooo just wait?
    console.debug("waiting for peer to acknowledge");
    return;
  }

  console.debug("I DONT KNOW WHAT TO DO!");
  return;
}

function* connectionSaga(playerId) {
  const peerConnection = yield call(newPeerConnection, true);
  const connected = fork(waitForConnection, peerConnection);
  const connectionChannel = yield call(peerConnectionChannel, peerConnection);

  let waitingForConnect = false;
  let connectTask;

  while (true) {
    try {
      if (waitingForConnect) {
        yield connected;

        console.debug("CONNECTED!");
        yield put(connectionConnected());

        // Build the interface for this game
        const gameMessageChannel = yield call(
          makeGameMessageChannel,
          peerConnection
        );

        const waitForGameMessage = (messageType) => {
          return () => {};
        };

        const sendGameMessage = ({ type, content }) => {
          const message = {
            type,
            ...content,
          };
          peerConnection.send(JSON.stringify(message));
        };

        const peerIdentifiers = yield call(getPeerIdentifiers, peerConnection);
        // TODO: add reset of some kind
        // or timeout?

        // TODO: support graceful closing from peer

        const destroy = () => peerConnection.destroy();

        return {
          peerIdentifiers,
          sendGameMessage,
          waitForGameMessage,
          destroy,
        };
      }

      const signal = yield take(connectionChannel);
      console.debug(signal);
      const { type } = signal;

      if (type === "offer") {
        const message = {
          playerId,
          offer: signal,
        };
        console.debug("saw offer, sharing as ", message);
        const { offer, answer, checkBackInMs, waitForConnection } = yield call(
          postData,
          joinGameURI,
          message
        );
        yield fork(
          handleResponse,
          offer,
          answer,
          checkBackInMs,
          waitForConnection,
          playerId,
          peerConnection
        );
        continue;
      }

      if (type === "answer") {
        const message = {
          playerId,
          answer: signal,
        };
        console.debug("saw answer, sharing as ", message);
        const { offer, answer, checkBackInMs, waitForConnection } = yield call(
          postData,
          joinGameURI,
          message
        );
        yield call(
          handleResponse,
          offer,
          answer,
          checkBackInMs,
          waitForConnection,
          playerId,
          peerConnection
        );
        waitingForConnect = true;
        yield cancel(connectTask);
        continue;
      }
      // yield fork(pong, socket);
    } catch (err) {
      console.error("channel error:", err);
      yield put(connectionErrored(err));
      // socketChannel is still open in catch block
      // if we want end the socketChannel, we need close it explicitly
      peerConnection.destroy();
    }
  }
}

export default connectionSaga;
