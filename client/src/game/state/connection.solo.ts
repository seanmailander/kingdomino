import {
  COMMITTMENT,
  committmentMessage,
  MOVE,
  moveMessage,
  REVEAL,
  revealMessage,
  START,
  type GameMessage,
  type GameMessagePayload,
  type GameMessageType,
  type PlayerMoveMessage,
} from "./game.messages";
import { up } from "../gamelogic/cards";

type AnyGameMessagePayload = {
  [MessageType in GameMessageType]: GameMessagePayload<MessageType>;
}[GameMessageType];

type MessageResolver = {
  resolve: (payload: AnyGameMessagePayload) => void;
  reject: (error: Error) => void;
};

export default class SoloConnection {
  readonly peerIdentifiers = {
    me: "me",
    them: "them",
  } as const;

  private readonly messageQueues = new Map<GameMessageType, unknown[]>();
  private readonly messageResolvers = new Map<GameMessageType, MessageResolver[]>();

  private isDestroyed = false;

  send = (message: GameMessage) => {
    this.assertActive();
    this.respondToMessage(message);
  };

  waitFor = <T extends GameMessageType>(messageType: T): Promise<GameMessagePayload<T>> => {
    this.assertActive();

    const queue = this.messageQueues.get(messageType) as Array<GameMessagePayload<T>> | undefined;
    if (queue && queue.length > 0) {
      return Promise.resolve(queue.shift() as GameMessagePayload<T>);
    }

    return new Promise<GameMessagePayload<T>>((resolve, reject) => {
      const resolvers = this.messageResolvers.get(messageType) ?? [];
      resolvers.push({
        resolve: (payload) => resolve(payload as GameMessagePayload<T>),
        reject,
      });
      this.messageResolvers.set(messageType, resolvers);
    });
  };

  destroy = () => {
    if (this.isDestroyed) {
      return;
    }

    this.isDestroyed = true;

    for (const resolvers of this.messageResolvers.values()) {
      for (const resolver of resolvers) {
        resolver.reject(new Error("SoloConnection destroyed while waiting for a message"));
      }
    }

    this.messageResolvers.clear();
    this.messageQueues.clear();
  };

  private respondToMessage(message: GameMessage) {
    switch (message.type) {
      case START:
        return;
      case COMMITTMENT:
        this.emitIncoming(COMMITTMENT, committmentMessage("their-committment").content);
        return;
      case REVEAL:
        this.emitIncoming(REVEAL, revealMessage("their-secret").content);
        this.emitOpponentMove();
        return;
      case MOVE:
        this.emitOpponentMove();
        return;
      default: {
        const _exhaustiveCheck: never = message;
        return;
      }
    }
  }

  private emitOpponentMove() {
    const move: PlayerMoveMessage = {
      playerId: this.peerIdentifiers.them,
      card: 0,
      x: 0,
      y: 0,
      direction: up,
    };

    this.emitIncoming(MOVE, moveMessage(move).content);
  }

  private emitIncoming<T extends GameMessageType>(messageType: T, payload: GameMessagePayload<T>) {
    const resolvers = this.messageResolvers.get(messageType);
    const resolver = resolvers?.shift();

    if (resolver) {
      resolver.resolve(payload as AnyGameMessagePayload);
      if (resolvers && resolvers.length === 0) {
        this.messageResolvers.delete(messageType);
      }
      return;
    }

    const queue = this.messageQueues.get(messageType) as Array<GameMessagePayload<T>> | undefined;
    if (queue) {
      queue.push(payload);
      return;
    }

    this.messageQueues.set(messageType, [payload]);
  }

  private assertActive() {
    if (this.isDestroyed) {
      throw new Error("SoloConnection has been destroyed");
    }
  }
}
