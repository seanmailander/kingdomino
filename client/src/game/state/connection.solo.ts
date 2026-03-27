import {
  COMMITTMENT,
  committmentMessage,
  MOVE,
  moveMessage,
  REVEAL,
  revealMessage,
  START,
  PAUSE_REQUEST,
  PAUSE_ACK,
  RESUME_REQUEST,
  RESUME_ACK,
  EXIT_REQUEST,
  EXIT_ACK,
  type GameMessage,
  type GameMessagePayload,
  type GameMessageType,
  type PlayerMoveMessage,
} from "./game.messages";
import { up } from "../gamelogic/cards";
import { commit } from "../gamelogic/utils";

type AnyGameMessagePayload = {
  [MessageType in GameMessageType]: GameMessagePayload<MessageType>;
}[GameMessageType];

type MessageResolver = {
  resolve: (payload: AnyGameMessagePayload) => void;
  reject: (error: Error) => void;
};

export class SoloConnection {
  readonly peerIdentifiers = {
    me: "me",
    them: "them",
  } as const;

  private readonly messageQueues = new Map<GameMessageType, unknown[]>();
  private readonly messageResolvers = new Map<GameMessageType, MessageResolver[]>();

  private isDestroyed = false;

  private readonly commitData = commit();

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

  private async respondToMessage(message: GameMessage) {
    const { secret, committment } = await this.commitData;
    switch (message.type) {
      case START:
        return;
      case COMMITTMENT:
        this.emitIncoming(COMMITTMENT, committmentMessage(committment).content);
        return;
      case REVEAL:
        this.emitIncoming(REVEAL, revealMessage(String(secret)).content);
        this.emitOpponentMove();
        return;
      case MOVE:
        this.emitOpponentMove();
        return;
      case PAUSE_REQUEST:
        this.emitIncoming(PAUSE_ACK, undefined);
        return;
      case RESUME_REQUEST:
        this.emitIncoming(RESUME_ACK, undefined);
        return;
      case EXIT_REQUEST:
        this.emitIncoming(EXIT_ACK, undefined);
        return;
      case PAUSE_ACK:
      case RESUME_ACK:
      case EXIT_ACK:
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

    // TODO: hardcoded move above — replace with something that helps a game progress
    // Maybe a decision tree for "good" moves

    // Example
    // Pick a random card
    // Place in a random (valid) position
    // Discard if not
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
