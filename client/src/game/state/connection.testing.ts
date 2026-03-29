import { commit } from "kingdomino-engine";
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
  committmentMessage,
  pickMessage,
  placeMessage,
  discardMessage,
  revealMessage,
  pauseAckMessage,
  resumeAckMessage,
  exitAckMessage,
  pauseRequestMessage,
  resumeRequestMessage,
  exitRequestMessage,
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

type TestHandshake = {
  secret: string | number;
  committment?: string;
};

type ScriptedMove = {
  card?: number;
  cardIndex?: number;
  discard?: true;
  x?: number;
  y?: number;
  direction?: string;
};

export type TestConnectionControl = {
  respondToPauseRequest?: boolean;
  respondToResumeRequest?: boolean;
  respondToExitRequest?: boolean;
  sendPauseRequestOnStart?: boolean;
};

export type TestConnectionScenario = {
  handshakes: ReadonlyArray<TestHandshake>;
  moves: ReadonlyArray<ScriptedMove>;
  control?: TestConnectionControl;
};

export type TestConnectionOptions = {
  me?: string;
  them?: string;
  scenario: TestConnectionScenario;
  /** Returns sorted unpicked card IDs from the current deal; used to resolve cardIndex. */
  getAvailableCards?: () => number[];
};

export class TestConnection {
  readonly peerIdentifiers: { me: string; them: string };

  private readonly scenario: TestConnectionScenario;
  private readonly messageQueues = new Map<WireMessageType, unknown[]>();
  private readonly messageResolvers = new Map<WireMessageType, MessageResolver[]>();

  private handshakeIndex = 0;
  private remoteMoveIndex = 0;
  private isDestroyed = false;
  private pauseRequestOnStartFired = false;
  private readonly getAvailableCards?: () => number[];

  constructor({ me = "me", them = "them", scenario, getAvailableCards }: TestConnectionOptions) {
    this.peerIdentifiers = { me, them };
    this.scenario = scenario;
    this.getAvailableCards = getAvailableCards;
  }

  send = (message: WireMessage) => {
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
      case PICK:
        return;
      case PLACE:
        return;
      case DISCARD:
        return;
      case PAUSE_REQUEST:
        if (this.scenario.control?.respondToPauseRequest) {
          this.emitIncoming(PAUSE_ACK, pauseAckMessage());
        }
        return;
      case RESUME_REQUEST:
        if (this.scenario.control?.respondToResumeRequest) {
          this.emitIncoming(RESUME_ACK, resumeAckMessage());
        }
        return;
      case EXIT_REQUEST:
        if (this.scenario.control?.respondToExitRequest) {
          this.emitIncoming(EXIT_ACK, exitAckMessage());
        }
        return;
      case PAUSE_ACK:
      case RESUME_ACK:
      case EXIT_ACK:
        return;
      default: {
        const exhaustiveCheck: never = message;
        return exhaustiveCheck;
      }
    }
  };

  triggerRemoteControl(type: "pause" | "resume" | "exit") {
    switch (type) {
      case "pause":  this.emitIncoming(PAUSE_REQUEST, pauseRequestMessage());  return;
      case "resume": this.emitIncoming(RESUME_REQUEST, resumeRequestMessage()); return;
      case "exit":   this.emitIncoming(EXIT_REQUEST, exitRequestMessage());    return;
    }
  }

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
    const committment = handshake.committment ?? (await commit(String(handshake.secret)));
    this.emitIncoming(COMMITTMENT, committmentMessage(committment).content);
  }

  private respondToReveal() {
    const handshake = this.currentHandshake();
    const isFirstRoundHandshake = this.handshakeIndex === 1;
    const ctrl = this.scenario.control;
    // When any control behavior is configured, skip move emissions so that
    // waitForPick() stays pending and pause/exit races resolve cleanly.
    const hasControlBehavior = !!(
      ctrl?.respondToPauseRequest ||
      ctrl?.respondToResumeRequest ||
      ctrl?.respondToExitRequest ||
      ctrl?.sendPauseRequestOnStart
    );

    let deferredMoveEmitter: (() => void) | null = null;
    if (this.handshakeIndex > 0 && !hasControlBehavior) {
      const scriptedMove = this.scenario.moves[this.handshakeIndex - 1];
      if (!scriptedMove) {
        throw new Error(
          `TestConnection scenario has no scripted move for round ${this.handshakeIndex}`,
        );
      }

      const { them } = this.peerIdentifiers;
      if (scriptedMove.cardIndex !== undefined) {
        // cardIndex must be resolved AFTER session.beginRound() is called (which happens
        // synchronously in the same microtask as the REVEAL resolution). Defer via setTimeout.
        const { cardIndex } = scriptedMove;
        deferredMoveEmitter = () => {
          const available = this.getAvailableCards?.() ?? [];
          const resolved = available[cardIndex];
          if (resolved === undefined) {
            throw new Error(
              `TestConnection cardIndex ${cardIndex} out of range (${available.length} available)`,
            );
          }
          this.emitMoveMessages(them, resolved, scriptedMove);
        };
      } else if (scriptedMove.card !== undefined) {
        const card = scriptedMove.card;
        deferredMoveEmitter = () => this.emitMoveMessages(them, card, scriptedMove);
      } else {
        throw new Error(`TestConnection scripted move for round ${this.handshakeIndex} has neither card nor cardIndex`);
      }
    }

    this.emitIncoming(REVEAL, revealMessage(String(handshake.secret)).content);
    this.handshakeIndex += 1;

    if (deferredMoveEmitter) {
      // buildTrustedSeed() has multiple awaits (verifyCommitment, combineSecrets) before
      // session.beginRound() is called. A macrotask (setTimeout 0) fires after ALL pending
      // microtasks complete, so the deal will be set by the time getAvailableCards() is called.
      const emitter = deferredMoveEmitter;
      setTimeout(() => emitter(), 0);
    }

    if (isFirstRoundHandshake && ctrl?.sendPauseRequestOnStart && !this.pauseRequestOnStartFired) {
      this.pauseRequestOnStartFired = true;
      // Delay long enough for test polling (vi.waitFor interval ~50ms) to observe Game state
      setTimeout(() => this.emitIncoming(PAUSE_REQUEST, pauseRequestMessage()), 100);
    }
  }

  /**
   * Emit the next scripted remote move directly, bypassing the handshake protocol.
   * Used by the visual test harness when a SequentialSeedProvider is injected.
   */
  scheduleNextRemoteMove(): void {
    this.assertActive();
    const scriptedMove = this.scenario.moves[this.remoteMoveIndex];
    if (!scriptedMove) return;
    this.remoteMoveIndex++;

    const { them } = this.peerIdentifiers;
    if (scriptedMove.cardIndex !== undefined) {
      const { cardIndex } = scriptedMove;
      setTimeout(() => {
        const available = this.getAvailableCards?.() ?? [];
        const resolved = available[cardIndex];
        if (resolved === undefined) {
          throw new Error(`TestConnection cardIndex ${cardIndex} out of range (${available.length} available)`);
        }
        this.emitMoveMessages(them, resolved, scriptedMove);
      }, 0);
    } else if (scriptedMove.card !== undefined) {
      this.emitMoveMessages(them, scriptedMove.card, scriptedMove);
    } else {
      throw new Error(`TestConnection scripted move for round ${this.remoteMoveIndex} has neither card nor cardIndex`);
    }
  }

  /** Emit PICK + PLACE (or DISCARD) messages for a scripted remote move. */
  private emitMoveMessages(playerId: string, cardId: number, move: ScriptedMove) {
    this.emitIncoming(PICK, pickMessage(playerId, cardId));
    if (move.discard) {
      this.emitIncoming(DISCARD, discardMessage(playerId));
    } else {
      // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
      this.emitIncoming(PLACE, placeMessage(playerId, move.x!, move.y!, move.direction! as import("kingdomino-engine").Direction));
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

  private assertScenarioAvailable(messageType: WireMessageType) {
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
