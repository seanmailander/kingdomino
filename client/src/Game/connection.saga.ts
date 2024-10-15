import { call, put, take, spawn, cancel, fork, join } from "redux-saga/effects";
import { eventChannel, channel, buffers } from "redux-saga";

import Peer from "peerjs";

import { postData } from "./gamelogic/fetch";
import { connectionConnected, connectionErrored } from "./game.actions";

const joinGameURI = "/api/letMeIn";

function makeGameMessageChannel(dataConnection) {
  return eventChannel((emit) => {
    // TODO: is this an npm module?

    const dataHandler = (data) => emit(data);
    const errorHandler = (err) => emit(new Error(err));

    // TODO: bubble up errors
    dataConnection.on("error", (err) => console.error("ERROR", err));
    dataConnection.on("data", dataHandler);
    dataConnection.on("error", errorHandler);

    // the subscriber must return an unsubscribe function
    // this will be invoked when the saga calls `channel.close` method
    const unsubscribe = () => {
      dataConnection.off("data", dataHandler);
      dataConnection.off("error", errorHandler);
    };

    return unsubscribe;
  }, buffers.expanding(10));
}

const awaitOnce = async (emitter, event) => {
  return new Promise((resolve, reject) => {
    emitter.once(event, resolve);
  });
};

const waitForPeerId = async (peerConnection) =>
  awaitOnce(peerConnection, "open");

const waitForConnection = async (peerConnection) => {
  const dataConnection = await awaitOnce(peerConnection, "connection");
  await waitForOpen(dataConnection);
  return dataConnection;
};
const waitForOpen = async (dataConnection) => awaitOnce(dataConnection, "open");

function waitFor(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function* filterMessages(messageChannel, messageType, bubbler) {
  while (true) {
    const message = yield take(messageChannel);
    if (message.type === messageType) {
      // console.debug("put message on bubbler for ", messageType, message);
      yield put(bubbler, message);
    }
  }
}

function* handleConnection(peerConnection, dataConnection) {
  yield put(connectionConnected());

  // Build the interface for this game
  function* waitForGameMessage(messageType) {
    const bubbler = yield call(channel, buffers.expanding(10));
    const messageChannel = yield call(makeGameMessageChannel, dataConnection);
    yield spawn(filterMessages, messageChannel, messageType, bubbler);
    return bubbler;
  }

  const sendGameMessage = ({ type, content }) => {
    const message = {
      type,
      ...content,
    };
    dataConnection.send(message);
  };

  console.debug(dataConnection);
  const peerIdentifiers = {
    me: peerConnection.id,
    them: dataConnection.peer,
  };

  // TODO: add reset of some kind
  // or timeout?

  // TODO: support graceful closing from peer
  const destroy = () => dataConnection.close();

  return {
    peerIdentifiers,
    sendGameMessage,
    waitForGameMessage,
    destroy,
  };
}

export function* newConnection() {
  const peerConnection = new Peer(undefined, {
    host: "kingdomino.local",
    path: "/api/peers",
    key: "default",
    config: { iceServers: [] },
  });
  const playerId = yield call(waitForPeerId, peerConnection);
  return {
    playerId,
    peerConnection,
  };
}

function* findOtherPlayers(peerConnection) {
  const playerId = peerConnection.id;
  const connected = yield fork(waitForConnection, peerConnection);

  let waitingForConnect = false;

  while (true) {
    try {
      if (waitingForConnect) {
        console.debug("waiting for dataCOnnection from peer", connected);
        const dataConnection = yield join(connected);
        return yield call(handleConnection, peerConnection, dataConnection);
      }

      const { otherPlayerId, checkBackInMs, waitForConnection } = yield call(
        postData,
        joinGameURI,
        { playerId },
      );
      if (otherPlayerId) {
        const dataConnection = peerConnection.connect(otherPlayerId);
        yield call(waitForOpen, dataConnection);
        yield cancel(connected);
        return yield call(handleConnection, peerConnection, dataConnection);
      }
      if (checkBackInMs) {
        // Was told to wait a little and check back in
        console.debug("Told to wait and try again");
        // So do that
        yield call(waitFor, checkBackInMs);
        continue;
      }

      if (waitForConnection) {
        console.debug("Told the connection should be coming");
        waitingForConnect = true;
        continue;
      }
    } catch (err) {
      console.error("channel error:", err);
      yield put(connectionErrored(err));
      // socketChannel is still open in catch block
      // if we want end the socketChannel, we need close it explicitly
      peerConnection.destroy();
      return err;
    }
  }
}

export default findOtherPlayers;
