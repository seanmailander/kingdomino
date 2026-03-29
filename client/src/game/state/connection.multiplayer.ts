import {
  COMMITTMENT,
  MOVE,
  REVEAL,
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
} from "./game.messages";

type AnyGameMessagePayload = {
  [MessageType in GameMessageType]: GameMessagePayload<MessageType>;
}[GameMessageType];

type MessageResolver = {
  resolve: (payload: AnyGameMessagePayload) => void;
  reject: (error: Error) => void;
};

export type MultiplayerTransport = {
  send: (message: GameMessage) => void;
  destroy?: () => void;
};

export type MultiplayerConnectionOptions = {
  me?: string;
  them?: string;
  transport?: MultiplayerTransport | null;
};

export class MultiplayerConnection {
  readonly peerIdentifiers: { me: string; them: string };

  private readonly messageQueues = new Map<GameMessageType, unknown[]>();
  private readonly messageResolvers = new Map<GameMessageType, MessageResolver[]>();

  private transport: MultiplayerTransport | null;
  private isDestroyed = false;

  constructor({ me = "me", them = "them", transport = null }: MultiplayerConnectionOptions = {}) {
    this.peerIdentifiers = { me, them };
    this.transport = transport;
  }

  setTransport = (transport: MultiplayerTransport | null) => {
    this.assertActive();
    this.transport = transport;
  };

  send = (message: GameMessage) => {
    this.assertActive();

    if (!this.transport) {
      throw new Error("MultiplayerConnection has no transport configured");
    }

    this.transport.send(message);
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

  receive = (message: GameMessage) => {
    this.assertActive();
    this.handleIncomingMessage(message);
  };

  destroy = () => {
    if (this.isDestroyed) {
      return;
    }

    this.isDestroyed = true;

    for (const resolvers of this.messageResolvers.values()) {
      for (const resolver of resolvers) {
        resolver.reject(new Error("MultiplayerConnection destroyed while waiting for a message"));
      }
    }

    this.messageResolvers.clear();
    this.messageQueues.clear();
    this.transport?.destroy?.();
    this.transport = null;
  };

  private handleIncomingMessage(message: GameMessage) {
    switch (message.type) {
      case START:
        this.emitIncoming(START, undefined as GameMessagePayload<typeof START>);
        return;
      case COMMITTMENT:
        this.emitIncoming(COMMITTMENT, message.content);
        return;
      case REVEAL:
        this.emitIncoming(REVEAL, message.content);
        return;
      case MOVE:
        this.emitIncoming(MOVE, message.content);
        return;
      case PAUSE_REQUEST:
      case PAUSE_ACK:
      case RESUME_REQUEST:
      case RESUME_ACK:
      case EXIT_REQUEST:
      case EXIT_ACK:
        // Control messages handled in Task 3
        return;
      default: {
        const exhaustiveCheck: never = message;
        return exhaustiveCheck;
      }
    }
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
      throw new Error("MultiplayerConnection has been destroyed");
    }
  }
}
