import {
  COMMITTMENT,
  PICK,
  PLACE,
  DISCARD,
  REVEAL,
  START,
  PAUSE_REQUEST,
  PAUSE_ACK,
  RESUME_REQUEST,
  RESUME_ACK,
  EXIT_REQUEST,
  EXIT_ACK,
  pickMessage,
  placeMessage,
  discardMessage,
  pauseAckMessage,
  resumeAckMessage,
  exitAckMessage,
  type WireMessage,
  type WireMessagePayload,
  type WireMessageType,
} from "kingdomino-protocol";
import type { RandomAIPlayer } from "kingdomino-protocol";
import type { CardId } from "kingdomino-engine";

type AnyWireMessagePayload = {
  [MessageType in WireMessageType]: WireMessagePayload<MessageType>;
}[WireMessageType];

type MessageResolver = {
  resolve: (payload: AnyWireMessagePayload) => void;
  reject: (error: Error) => void;
};

export class SoloConnection {
  readonly peerIdentifiers = {
    me: "me",
    them: "them",
  } as const;

  private readonly aiPlayer: RandomAIPlayer;
  private readonly messageQueues = new Map<WireMessageType, unknown[]>();
  private readonly messageResolvers = new Map<WireMessageType, MessageResolver[]>();
  private pendingLocalPickCard: CardId | null = null;

  private isDestroyed = false;

  constructor(aiPlayer: RandomAIPlayer) {
    this.aiPlayer = aiPlayer;
  }

  send = (message: WireMessage) => {
    this.assertActive();
    this.respondToMessage(message);
  };

  waitFor = <T extends WireMessageType>(messageType: T): Promise<WireMessagePayload<T>> => {
    this.assertActive();

    const queue = this.messageQueues.get(messageType) as Array<WireMessagePayload<T>> | undefined;
    if (queue && queue.length > 0) {
      return Promise.resolve(queue.shift() as WireMessagePayload<T>);
    }

    return new Promise<WireMessagePayload<T>>((resolve, reject) => {
      const resolvers = this.messageResolvers.get(messageType) ?? [];
      resolvers.push({
        resolve: (payload) => resolve(payload as WireMessagePayload<T>),
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

  private async respondToMessage(message: WireMessage) {
    switch (message.type) {
      case START:
        return;
      case COMMITTMENT:
        // Solo mode uses RandomSeedProvider — commitment exchange is not used.
        return;
      case REVEAL:
        // Solo mode uses RandomSeedProvider — commitment exchange is not used.
        return;
      case PICK:
        this.pendingLocalPickCard = message.cardId;
        return;
      case PLACE:
        if (this.pendingLocalPickCard !== null) {
          this.aiPlayer.receiveHumanMove(this.pendingLocalPickCard, message.x, message.y, message.direction);
          this.pendingLocalPickCard = null;
          if (this.aiPlayer.hasActiveRound()) {
            this.emitOpponentMove();
          }
        }
        return;
      case DISCARD:
        if (this.pendingLocalPickCard !== null) {
          this.aiPlayer.receiveHumanDiscard(this.pendingLocalPickCard);
          this.pendingLocalPickCard = null;
          if (this.aiPlayer.hasActiveRound()) {
            this.emitOpponentMove();
          }
        }
        return;
      case PAUSE_REQUEST:
        this.emitIncoming(PAUSE_ACK, pauseAckMessage());
        return;
      case RESUME_REQUEST:
        this.emitIncoming(RESUME_ACK, resumeAckMessage());
        return;
      case EXIT_REQUEST:
        this.emitIncoming(EXIT_ACK, exitAckMessage());
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

  private emitOpponentMove() {
    if (!this.aiPlayer.hasActiveRound()) return;
    const move = this.aiPlayer.generateMove();
    this.emitIncoming(PICK, pickMessage(move.playerId, move.cardId));
    if ("discard" in move) {
      this.emitIncoming(DISCARD, discardMessage(move.playerId));
    } else {
      this.emitIncoming(PLACE, placeMessage(move.playerId, move.x, move.y, move.direction));
    }
  }

  private emitIncoming<T extends WireMessageType>(messageType: T, payload: WireMessagePayload<T>) {
    const resolvers = this.messageResolvers.get(messageType);
    const resolver = resolvers?.shift();

    if (resolver) {
      resolver.resolve(payload as AnyWireMessagePayload);
      if (resolvers && resolvers.length === 0) {
        this.messageResolvers.delete(messageType);
      }
      return;
    }

    const queue = this.messageQueues.get(messageType) as Array<WireMessagePayload<T>> | undefined;
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
