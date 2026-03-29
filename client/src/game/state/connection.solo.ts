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
} from "./game.messages";
import type { RandomAIPlayer } from "./ai.player";

// Old commitment protocol — kept for compatibility until Task 8
const hashIt = async (input: string | number): Promise<string> => {
  const encoder = new TextEncoder();
  const data = encoder.encode(String(input));
  const hash = await crypto.subtle.digest("SHA-1", data);
  return btoa(String.fromCharCode(...new Uint8Array(hash)));
};
const commit = async (): Promise<{ secret: number; committment: string }> => {
  const randomNumber = crypto.getRandomValues(new Uint32Array(1))[0];
  return { secret: randomNumber, committment: await hashIt(randomNumber) };
};

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

  private readonly aiPlayer: RandomAIPlayer;
  private readonly messageQueues = new Map<GameMessageType, unknown[]>();
  private readonly messageResolvers = new Map<GameMessageType, MessageResolver[]>();

  private isDestroyed = false;

  private readonly commitData = commit();

  constructor(aiPlayer: RandomAIPlayer) {
    this.aiPlayer = aiPlayer;
  }

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

    this.aiPlayer.destroy();
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
        // Don't emit AI move here — REVEAL fires twice per game (pick-order seed + round-card
        // seed), and beginRound() hasn't been called yet at that point. Instead,
        // LobbyFlow calls notifyRoundStarted() after beginRound().
        return;
      case MOVE:
        this.aiPlayer.receiveHumanMove(
          message.content.move.card,
          message.content.move.x,
          message.content.move.y,
          message.content.move.direction,
        );
        // Only emit if the round is still active — the human's last pick ends the round.
        if (this.aiPlayer.hasActiveRound()) {
          this.emitOpponentMove();
        }
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

  /** Called by LobbyFlow after beginRound(): emits the AI's first move if AI acts first. */
  notifyRoundStarted(): void {
    if (this.aiPlayer.isFirstToAct()) {
      this.emitOpponentMove();
    }
  }

  /** Called by LobbyFlow when the human discards: advances AI session and triggers AI move if needed. */
  notifyLocalDiscard(cardId: number): void {
    this.aiPlayer.receiveHumanDiscard(cardId);
    if (this.aiPlayer.hasActiveRound()) {
      this.emitOpponentMove();
    }
  }

  private emitOpponentMove() {
    if (!this.aiPlayer.hasActiveRound()) return;
    const move = this.aiPlayer.generateMove();
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
