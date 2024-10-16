import EventEmitter from "eventemitter3";

import { call, put, take, spawn } from "redux-saga/effects";
import { eventChannel, channel, buffers } from "redux-saga";

import {
  COMMITTMENT,
  committmentMessage,
  MOVE,
  moveMessage,
  REVEAL,
  revealMessage,
} from "./game.messages";
import { MovePayload } from "./types";

const unwrapReturnMessage = ({ type, content }) => ({
  type,
  ...content,
});

function responseToPlayerMove(gameMessage, emit) {
  switch (gameMessage.type) {
    case COMMITTMENT: {
      emit(unwrapReturnMessage(committmentMessage("their-committment")));
      break;
    }
    case REVEAL: {
      emit(unwrapReturnMessage(revealMessage("their-secret")));
      const move: MovePayload = {
        playerId: "them",
        card: 0,
        x: 0,
        y: 0,
        direction: 0,
      };
      // emit a first move, just in case its my turn
      emit(unwrapReturnMessage(moveMessage(move)));
      break;
    }
    case MOVE: {
      const move: MovePayload = {
        playerId: "them",
        card: 0,
        x: 0,
        y: 0,
        direction: 0,
      };
      emit(unwrapReturnMessage(moveMessage(move)));
      break;
    }
    default: {
      // noop;
    }
  }
}

function makeGameMessageChannel(dataConnection) {
  return eventChannel((emit) => {
    const dataHandler = (gameMessage) =>
      responseToPlayerMove(gameMessage, emit);
    dataConnection.on("player1", dataHandler);

    // the subscriber must return an unsubscribe function
    // this will be invoked when the saga calls `channel.close` method
    const unsubscribe = () => {
      dataConnection.off("player1", dataHandler);
    };

    return unsubscribe;
    //@ts-expect-error as-is
  }, buffers.expanding(10));
}

function* filterMessages(messageChannel, messageType, bubbler) {
  while (true) {
    const message = yield take(messageChannel);
    if (message.type === messageType) {
      console.log("bubbling", messageType, message);
      yield put(bubbler, message);
    }
  }
}

function newSoloConnection() {
  const inprocEmitter = new EventEmitter(); // Build the interface for this game

  function* waitForGameMessage(messageType) {
    const bubbler = yield call(channel, buffers.expanding(10));
    const messageChannel = yield call(makeGameMessageChannel, inprocEmitter);
    yield spawn(filterMessages, messageChannel, messageType, bubbler);
    return bubbler;
  }

  const sendGameMessage = ({ type, content }) => {
    const message = {
      type,
      ...content,
    };
    inprocEmitter.emit("player1", message);
  };

  const peerIdentifiers = {
    me: "me",
    them: "them",
  };

  // TODO: add reset of some kind
  // or timeout?

  // TODO: support graceful closing from peer
  const destroy = () => {
    // @ts-expect-error as-is
    inprocEmitter.close();
  };

  return {
    peerIdentifiers,
    sendGameMessage,
    waitForGameMessage,
    destroy,
  };
}

export default newSoloConnection;
