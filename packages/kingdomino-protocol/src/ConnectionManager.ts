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
type WaitForPlaceOrDiscard = () => Promise<PlaceMessage | DiscardMessage>;

export class ConnectionManager {
  private readonly send: SendWireMessage;
  private readonly waitFor: WaitForWireMessage;
  private readonly waitForPlaceOrDiscardFn: WaitForPlaceOrDiscard | undefined;

  constructor(
    send: SendWireMessage,
    waitFor: WaitForWireMessage,
    waitForPlaceOrDiscard?: WaitForPlaceOrDiscard,
  ) {
    this.send = send;
    this.waitFor = waitFor;
    this.waitForPlaceOrDiscardFn = waitForPlaceOrDiscard;
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
   * losing type. Uses an injected cancellation-aware implementation when available
   * (provided by MultiplayerConnection.waitForPlaceOrDiscard); falls back to the racy
   * approach for callers that don't provide one (safe for single-round use only).
   */
  waitForPlaceOrDiscard(): Promise<PlaceMessage | DiscardMessage> {
    if (this.waitForPlaceOrDiscardFn) {
      return this.waitForPlaceOrDiscardFn();
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
    return Promise.race([
      this.waitFor(PICK)    as Promise<PickMessage>,
      this.waitFor(PLACE)   as Promise<PlaceMessage>,
      this.waitFor(DISCARD) as Promise<DiscardMessage>,
    ]);
  }

  /**
   * Await both the PICK and the associated PLACE/DISCARD from the remote peer as a unit.
   * Returns null if the connection is destroyed before both arrive.
   * Pre-registers all rejection handlers synchronously to prevent unhandled rejections.
   */
  async waitForPickAndPlacement(): Promise<{ pick: PickMessage; place: PlaceMessage | DiscardMessage } | null> {
    // Register rejection handlers synchronously BEFORE any await
    const pickOrNull = (this.waitFor(PICK) as Promise<PickMessage>).catch((): null => null);
    const placeOrNull = (this.waitFor(PLACE) as Promise<PlaceMessage>).catch((): null => null);
    const discardOrNull = (this.waitFor(DISCARD) as Promise<DiscardMessage>).catch((): null => null);

    const pick = await pickOrNull;
    if (!pick) return null;

    const place = await Promise.race([placeOrNull, discardOrNull]);
    return place ? { pick, place } : null;
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
