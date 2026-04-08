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

type SendWireMessage = (message: WireMessage) => void;
export type WaitForOneOfFn = <Types extends WireMessageType[]>(
  ...types: Types
) => Promise<WireMessagePayload<Types[number]>>;

export class ConnectionManager {
  private readonly send: SendWireMessage;
  private readonly waitFor: WaitForOneOfFn;

  constructor(
    send: SendWireMessage,
    waitForOneOf: WaitForOneOfFn,
  ) {
    this.send = send;
    this.waitFor = waitForOneOf;
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

  /** Await either a PLACE or DISCARD message without leaving a stale resolver for the losing type. */
  waitForPlaceOrDiscard(): Promise<PlaceMessage | DiscardMessage> {
    return this.waitFor(PLACE, DISCARD) as Promise<PlaceMessage | DiscardMessage>;
  }

  /** Await the next move message of any type from the remote peer */
  waitForNextMoveMessage(): Promise<MoveMessage> {
    return this.waitFor(PICK, PLACE, DISCARD) as Promise<MoveMessage>;
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
