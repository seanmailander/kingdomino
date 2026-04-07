// TODO: MultiplayerConnection serves as the transport layer for
// RemotePlayerActor (architecture-report §9.4). It owns the raw send/receive
// primitives and the per-message-type queuing. A future rename/restructure may
// move this to a transport-focused module (e.g. peer.transport.ts) to clarify
// that MultiplayerConnection is not itself a PlayerActor — it is a building
// block that RemotePlayerActor wraps.
import type { PlaceMessage, DiscardMessage } from "./game.messages";
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
  type WireMessage,
  type WireMessagePayload,
  type WireMessageType,
} from "./game.messages";

type AnyWireMessagePayload = {
  [MessageType in WireMessageType]: WireMessagePayload<MessageType>;
}[WireMessageType];

type MessageResolver = {
  resolve: (payload: AnyWireMessagePayload) => void;
  reject: (error: Error) => void;
};

export type MultiplayerTransport = {
  send: (message: WireMessage) => void;
  destroy?: () => void;
};

export type MultiplayerConnectionOptions = {
  me?: string;
  them?: string;
  transport?: MultiplayerTransport | null;
};

export class MultiplayerConnection {
  readonly peerIdentifiers: { me: string; them: string };

  private readonly messageQueues = new Map<WireMessageType, unknown[]>();
  private readonly messageResolvers = new Map<WireMessageType, MessageResolver[]>();

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

  send = (message: WireMessage) => {
    this.assertActive();

    if (!this.transport) {
      throw new Error("MultiplayerConnection has no transport configured");
    }

    this.transport.send(message);
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

  /**
   * Await either a PLACE or DISCARD message, registering a single paired resolver
   * for both types and cleaning up the losing registration when one arrives.
   * This prevents stale resolvers from silently consuming messages in later rounds.
   */
  waitForPlaceOrDiscard = (): Promise<PlaceMessage | DiscardMessage> => {
    this.assertActive();

    // Drain any already-queued PLACE or DISCARD before registering new resolvers.
    const placeQueue = this.messageQueues.get(PLACE) as PlaceMessage[] | undefined;
    if (placeQueue && placeQueue.length > 0) {
      return Promise.resolve(placeQueue.shift()!);
    }
    const discardQueue = this.messageQueues.get(DISCARD) as DiscardMessage[] | undefined;
    if (discardQueue && discardQueue.length > 0) {
      return Promise.resolve(discardQueue.shift()!);
    }

    return new Promise<PlaceMessage | DiscardMessage>((resolve, reject) => {
      let settled = false;

      const makeResolver = (
        ownType: typeof PLACE | typeof DISCARD,
        otherType: typeof PLACE | typeof DISCARD,
      ): MessageResolver => ({
        resolve: (payload) => {
          if (settled) return;
          settled = true;
          // Remove the companion resolver so it cannot consume a future message.
          const companions = this.messageResolvers.get(otherType);
          if (companions) {
            const idx = companions.indexOf(resolvers.get(otherType)!);
            if (idx !== -1) companions.splice(idx, 1);
            if (companions.length === 0) this.messageResolvers.delete(otherType);
          }
          resolve(payload as PlaceMessage | DiscardMessage);
        },
        reject: (err) => {
          if (settled) return;
          settled = true;
          reject(err);
        },
      });

      // Build both resolvers before registering either (they reference each other via the Map).
      const resolvers = new Map<typeof PLACE | typeof DISCARD, MessageResolver>([
        [PLACE,   makeResolver(PLACE, DISCARD)],
        [DISCARD, makeResolver(DISCARD, PLACE)],
      ]);

      for (const [type, resolver] of resolvers) {
        const list = this.messageResolvers.get(type) ?? [];
        list.push(resolver);
        this.messageResolvers.set(type, list);
      }
    });
  };

  receive = (message: WireMessage) => {
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

  private handleIncomingMessage(message: WireMessage) {
    switch (message.type) {
      case START:
        this.emitIncoming(START, { type: START });
        return;
      case COMMITTMENT:
        this.emitIncoming(COMMITTMENT, message.content);
        return;
      case REVEAL:
        this.emitIncoming(REVEAL, message.content);
        return;
      case PICK:
        this.emitIncoming(PICK, message);
        return;
      case PLACE:
        this.emitIncoming(PLACE, message);
        return;
      case DISCARD:
        this.emitIncoming(DISCARD, message);
        return;
      case PAUSE_REQUEST:
      case PAUSE_ACK:
      case RESUME_REQUEST:
      case RESUME_ACK:
      case EXIT_REQUEST:
      case EXIT_ACK:
        this.emitIncoming(message.type, message);
        return;
      default: {
        const exhaustiveCheck: never = message;
        return exhaustiveCheck;
      }
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
      throw new Error("MultiplayerConnection has been destroyed");
    }
  }
}
