import type { PlayerId, CardId, Direction } from "kingdomino-engine";
import {
  PICK, PLACE, DISCARD,
  PAUSE_REQUEST,
  PAUSE_ACK,
  RESUME_REQUEST,
  RESUME_ACK,
  EXIT_REQUEST,
  EXIT_ACK,
  pickMessage,
  placeMessage,
  discardMessage,
  startMessage,
  pauseRequestMessage,
  pauseAckMessage,
  resumeRequestMessage,
  resumeAckMessage,
  exitRequestMessage,
  exitAckMessage,
  type WireMessage,
  type WireMessagePayload,
  type WireMessageType,
  type PickMessage,
  type PlaceMessage,
  type DiscardMessage,
  type MoveMessage,
} from "./game.messages";

type WaitForWireMessage = <T extends WireMessageType>(
  messageType: T,
) => Promise<WireMessagePayload<T>>;
type SendWireMessage = (message: WireMessage) => void;
type WaitForOneOfFn = <Types extends WireMessageType[]>(
  ...types: Types
) => Promise<WireMessagePayload<Types[number]>>;

export class ConnectionManager {
  private readonly send: SendWireMessage;
  private readonly waitFor: WaitForWireMessage;
  private readonly waitForOneOfFn: WaitForOneOfFn | undefined;

  constructor(
    send: SendWireMessage,
    waitFor: WaitForWireMessage,
    waitForOneOf?: WaitForOneOfFn,
  ) {
    this.send = send;
    this.waitFor = waitFor;
    this.waitForOneOfFn = waitForOneOf;
  }

  sendStart() {
    this.send(startMessage());
  }

  sendPick(playerId: PlayerId, cardId: CardId) {
    this.send(pickMessage(playerId, cardId));
  }

  sendPlace(playerId: PlayerId, x: number, y: number, direction: Direction) {
    this.send(placeMessage(playerId, x, y, direction));
  }

  sendDiscard(playerId: PlayerId) {
    this.send(discardMessage(playerId));
  }

  waitForPick()    { return this.waitFor(PICK) as Promise<PickMessage>; }
  waitForPlace()   { return this.waitFor(PLACE) as Promise<PlaceMessage>; }
  waitForDiscard() { return this.waitFor(DISCARD) as Promise<DiscardMessage>; }

  /**
   * Await either a PLACE or DISCARD message without leaving a stale resolver for the
   * losing type. Uses the injected cancellation-aware waitForOneOf when available;
   * falls back to the racy approach for callers that don't provide one (safe for
   * single-round use only).
   */
  waitForPlaceOrDiscard(): Promise<PlaceMessage | DiscardMessage> {
    if (this.waitForOneOfFn) {
      return this.waitForOneOfFn(PLACE, DISCARD) as Promise<PlaceMessage | DiscardMessage>;
    }
    // Fallback: racy — leaves a stale resolver for the losing type.
    // Only safe when awaitPlacement() is called at most once per connection lifetime.
    const placeOrNull = this.waitForPlace().catch((): null => null);
    const discardOrNull = this.waitForDiscard().catch((): null => null);
    return Promise.race([placeOrNull, discardOrNull]).then((msg) => {
      if (!msg) throw new Error("ConnectionManager: connection closed while waiting for place or discard");
      return msg;
    });
  }

  /** Await the next move message of any type from the remote peer */
  async waitForNextMoveMessage(): Promise<MoveMessage> {
    if (this.waitForOneOfFn) {
      return this.waitForOneOfFn(PICK, PLACE, DISCARD) as Promise<MoveMessage>;
    }
    // Fallback: racy — accumulates stale resolvers in loops.
    // Only safe for connections that do not provide waitForOneOf.
    return Promise.race([
      this.waitFor(PICK)    as Promise<PickMessage>,
      this.waitFor(PLACE)   as Promise<PlaceMessage>,
      this.waitFor(DISCARD) as Promise<DiscardMessage>,
    ]);
  }

  sendPauseRequest()  { this.send(pauseRequestMessage()); }
  sendPauseAck()      { this.send(pauseAckMessage()); }
  sendResumeRequest() { this.send(resumeRequestMessage()); }
  sendResumeAck()     { this.send(resumeAckMessage()); }
  sendExitRequest()   { this.send(exitRequestMessage()); }
  sendExitAck()       { this.send(exitAckMessage()); }

  waitForPauseAck(timeoutMs: number)   { return this.waitForWithTimeout(PAUSE_ACK, timeoutMs); }
  waitForPauseRequest()                { return this.waitFor(PAUSE_REQUEST); }
  waitForResumeAck(timeoutMs: number)  { return this.waitForWithTimeout(RESUME_ACK, timeoutMs); }
  waitForResumeRequest()               { return this.waitFor(RESUME_REQUEST); }
  waitForExitAck(timeoutMs: number)    { return this.waitForWithTimeout(EXIT_ACK, timeoutMs); }
  waitForExitRequest()                 { return this.waitFor(EXIT_REQUEST); }

  private waitForWithTimeout<T extends WireMessageType>(
    messageType: T,
    timeoutMs: number,
  ): Promise<WireMessagePayload<T>> {
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        reject(new Error(`Timeout waiting for ${messageType}`));
      }, timeoutMs);
      this.waitFor(messageType).then(
        (payload) => { clearTimeout(timer); resolve(payload); },
        (err) => { clearTimeout(timer); reject(err); },
      );
    });
  }
}
