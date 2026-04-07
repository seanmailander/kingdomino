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

  waitForOneOf = <Types extends WireMessageType[]>(
    ...types: Types
  ): Promise<WireMessagePayload<Types[number]>> => {
    this.assertActive();

    // Drain any already-queued message (first matching type wins).
    for (const type of types) {
      const queue = this.messageQueues.get(type) as Array<WireMessagePayload<typeof type>> | undefined;
      if (queue && queue.length > 0) {
        return Promise.resolve(queue.shift() as WireMessagePayload<Types[number]>);
      }
    }

    return new Promise<WireMessagePayload<Types[number]>>((resolve, reject) => {
      let settled = false;

      const makeResolver = (ownType: WireMessageType): MessageResolver => ({
        resolve: (payload) => {
          if (settled) return;
          settled = true;
          // Remove companion resolvers for all other types.
          for (const otherType of types) {
            if (otherType === ownType) continue;
            const companions = this.messageResolvers.get(otherType);
            if (companions) {
              const idx = companions.indexOf(resolverMap.get(otherType)!);
              if (idx !== -1) companions.splice(idx, 1);
              if (companions.length === 0) this.messageResolvers.delete(otherType);
            }
          }
          resolve(payload as WireMessagePayload<Types[number]>);
        },
        reject: (err) => {
          if (settled) return;
          settled = true;
          reject(err);
        },
      });

      const resolverMap = new Map<WireMessageType, MessageResolver>(
        types.map((type) => [type, makeResolver(type)]),
      );

      for (const [type, resolver] of resolverMap) {
        const list = this.messageResolvers.get(type) ?? [];
        list.push(resolver);
        this.messageResolvers.set(type, list);
      }
    });
  };

  /**
   * Await either a PLACE or DISCARD message. Delegates to waitForOneOf,
   * which registers paired cancellation-aware resolvers for both types.
   */
  waitForPlaceOrDiscard = (): Promise<PlaceMessage | DiscardMessage> =>
    this.waitForOneOf(PLACE, DISCARD) as Promise<PlaceMessage | DiscardMessage>;

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
