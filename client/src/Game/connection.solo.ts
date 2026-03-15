import EventEmitter from "eventemitter3";

import {
  COMMITTMENT,
  committmentMessage,
  MOVE,
  moveMessage,
  REVEAL,
  revealMessage,
} from "./game.messages";

type GameMessage = {
  type: string;
  [key: string]: unknown;
};

const unwrapReturnMessage = ({ type, content }: { type: string; content?: object }) => ({
  type,
  ...content,
});

function responseToPlayerMove(gameMessage: GameMessage, emit: (message: GameMessage) => void) {
  switch (gameMessage.type) {
    case COMMITTMENT: {
      emit(unwrapReturnMessage(committmentMessage("their-committment")));
      break;
    }
    case REVEAL: {
      emit(unwrapReturnMessage(revealMessage("their-secret")));
      const move = {
        playerId: "them",
        card: 0,
        x: 0,
        y: 0,
        direction: 0,
      };
      emit(unwrapReturnMessage(moveMessage(move)));
      break;
    }
    case MOVE: {
      const move = {
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
      break;
    }
  }
}

function createMessageWaiter(dataConnection: EventEmitter) {
  const messageQueues: Record<string, GameMessage[]> = {};
  const messageResolvers: Record<string, Array<(message: GameMessage) => void>> = {};

  const dataHandler = (gameMessage: GameMessage) => {
    const queueType = gameMessage.type;
    const resolver = messageResolvers[queueType]?.shift();

    if (resolver) {
      resolver(gameMessage);
      return;
    }

    messageQueues[queueType] = messageQueues[queueType] ?? [];
    messageQueues[queueType].push(gameMessage);
  };

  dataConnection.on("incoming", dataHandler);

  const waitForGameMessage = async <T = GameMessage>(messageType: string): Promise<T> => {
    const queue = messageQueues[messageType] ?? [];
    if (queue.length > 0) {
      return queue.shift() as T;
    }

    return new Promise<T>((resolve) => {
      messageResolvers[messageType] = messageResolvers[messageType] ?? [];
      messageResolvers[messageType].push(resolve as (message: GameMessage) => void);
    });
  };

  const dispose = () => {
    dataConnection.off("incoming", dataHandler);
  };

  return {
    waitForGameMessage,
    dispose,
  };
}

function newSoloConnection() {
  const inprocEmitter = new EventEmitter();
  const { waitForGameMessage, dispose } = createMessageWaiter(inprocEmitter);

  const sendGameMessage = ({ type, content }: { type: string; content?: unknown }) => {
    const message =
      typeof content === "object" && content ? { type, ...content } : { type };

    responseToPlayerMove(message as GameMessage, (reply) => inprocEmitter.emit("incoming", reply));
  };

  const peerIdentifiers = {
    me: "me",
    them: "them",
  };

  const destroy = () => {
    dispose();
    inprocEmitter.removeAllListeners();
  };

  return {
    peerIdentifiers,
    sendGameMessage,
    waitForGameMessage,
    destroy,
  };
}

export default newSoloConnection;