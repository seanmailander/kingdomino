import EventEmitter from "eventemitter3";

import {
  COMMITTMENT,
  committmentMessage,
  MOVE,
  moveMessage,
  REVEAL,
  revealMessage,
  type ValidMessages,
} from "./game.messages";
import type { GameConnection, MovePayload } from "../types";

function responseToPlayerMove(gameMessage, emit) {
  switch (gameMessage.type) {
    case COMMITTMENT: {
      emit(committmentMessage("their-committment"));
      break;
    }
    case REVEAL: {
      emit(revealMessage("their-secret"));
      const move: MovePayload = {
        playerId: "them",
        card: 0,
        x: 0,
        y: 0,
        direction: 0,
      };
      // emit a first move, just in case its my turn
      emit(moveMessage(move));
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
      emit(moveMessage(move));
      break;
    }
    default: {
      // noop;
    }
  }
}

type ValidGameEvents = {
  [messageType in ValidMessages["type"]]: ValidMessages;
};

export const newSoloConnection: () => GameConnection = () => {
  const inprocEmitter = new EventEmitter<ValidGameEvents>(); // Build the interface for this game

  const waitForGameMessage: GameConnection["waitForGameMessage"] = async (
    messageType,
  ) => {
    return new Promise((resolve, reject) => {
      const handleMatchingMessage = (message: ValidMessages) => {
        if (message.type === messageType) {
          console.log("bubbling", messageType, message);
          resolve(message);
          inprocEmitter.off(messageType, handleMatchingMessage);
        }
      };
      inprocEmitter.on(messageType, handleMatchingMessage);
    });
  };

  const sendGameMessage: GameConnection["sendGameMessage"] = (message) => {
    console.log("emitting", message.type, message);
    inprocEmitter.emit(message.type, message);
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

  const players = [
    {
      playerId: peerIdentifiers.me,
      isMe: true,
    },
    {
      playerId: peerIdentifiers.them,
      isMe: false,
    },
  ];

  return {
    players,
    sendGameMessage,
    waitForGameMessage,
    destroy,
  };
};
