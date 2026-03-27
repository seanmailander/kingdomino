import { hashIt } from "../gamelogic/utils";
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
  committmentMessage,
  moveMessage,
  revealMessage,
  type GameMessage,
  type GameMessagePayload,
  type GameMessageType,
  type PlayerMoveMessage,
} from "./game.messages";

type AnyGameMessagePayload = {
  [MessageType in GameMessageType]: GameMessagePayload<MessageType>;
}[GameMessageType];

type MessageResolver = {
  resolve: (payload: AnyGameMessagePayload) => void;
  reject: (error: Error) => void;
};

type TestHandshake = {
  secret: string | number;
  committment?: string;
};

type ScriptedMove = Omit<PlayerMoveMessage, "playerId">;

export type TestConnectionScenario = {
  handshakes: ReadonlyArray<TestHandshake>;
  moves: ReadonlyArray<ScriptedMove>;
};

export type TestConnectionOptions = {
  me?: string;
  them?: string;
  scenario: TestConnectionScenario;
};

export class TestConnection {
  readonly peerIdentifiers: { me: string; them: string };

  private readonly scenario: TestConnectionScenario;
  private readonly messageQueues = new Map<GameMessageType, unknown[]>();
  private readonly messageResolvers = new Map<GameMessageType, MessageResolver[]>();

  private handshakeIndex = 0;
  private isDestroyed = false;

  constructor({ me = "me", them = "them", scenario }: TestConnectionOptions) {
    if (scenario.handshakes.length === 0) {
      throw new Error("TestConnection scenario requires at least one handshake");
    }

    this.peerIdentifiers = { me, them };
    this.scenario = scenario;
  }

  send = (message: GameMessage) => {
    this.assertActive();
    this.assertScenarioAvailable(message.type);

    switch (message.type) {
      case START:
        return;
      case COMMITTMENT:
        void this.respondToCommittment();
        return;
      case REVEAL:
        this.respondToReveal();
        return;
      case MOVE:
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
        resolver.reject(new Error("TestConnection destroyed while waiting for a message"));
      }
    }

    this.messageResolvers.clear();
    this.messageQueues.clear();
  };

  private async respondToCommittment() {
    const handshake = this.currentHandshake();
    const committment = handshake.committment ?? (await hashIt(handshake.secret));
    this.emitIncoming(COMMITTMENT, committmentMessage(committment).content);
  }

  private respondToReveal() {
    const handshake = this.currentHandshake();

    let queuedMove: GameMessagePayload<typeof MOVE> | null = null;
    if (this.handshakeIndex > 0) {
      const scriptedMove = this.scenario.moves[this.handshakeIndex - 1];
      if (!scriptedMove) {
        throw new Error(
          `TestConnection scenario has no scripted move for round ${this.handshakeIndex}`,
        );
      }

      queuedMove = moveMessage({ playerId: this.peerIdentifiers.them, ...scriptedMove }).content;
    }

    this.emitIncoming(REVEAL, revealMessage(handshake.secret).content);

    this.handshakeIndex += 1;

    if (queuedMove) {
      this.emitIncoming(MOVE, queuedMove);
    }
  }

  private currentHandshake() {
    const handshake = this.scenario.handshakes[this.handshakeIndex];
    if (!handshake) {
      throw new Error(
        `TestConnection scenario has no handshake script for exchange ${this.handshakeIndex + 1}`,
      );
    }

    return handshake;
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

  private assertScenarioAvailable(messageType: GameMessageType) {
    if (
      (messageType === COMMITTMENT || messageType === REVEAL) &&
      !this.scenario.handshakes[this.handshakeIndex]
    ) {
      throw new Error(
        `TestConnection scenario has no handshake script for exchange ${this.handshakeIndex + 1}`,
      );
    }
  }

  private assertActive() {
    if (this.isDestroyed) {
      throw new Error("TestConnection has been destroyed");
    }
  }
}
