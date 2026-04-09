import {
  PICK, PLACE, DISCARD,
  type WireMessage,
  type WireMessagePayload,
  type WireMessageType,
  type PickMessage,
  type PlaceMessage,
  type DiscardMessage,
} from "./game.messages";

export type WaitForOneOfFn = <Types extends WireMessageType[]>(
  ...types: Types
) => Promise<WireMessagePayload<Types[number]>>;

export class ConnectionManager {
  private readonly waitFor: WaitForOneOfFn;

  constructor(
    _send: (message: WireMessage) => void,
    waitForOneOf: WaitForOneOfFn,
  ) {
    this.waitFor = waitForOneOf;
  }

  waitForPick()    { return this.waitFor(PICK) as Promise<PickMessage>; }

  /** Await either a PLACE or DISCARD message without leaving a stale resolver for the losing type. */
  waitForPlaceOrDiscard(): Promise<PlaceMessage | DiscardMessage> {
    return this.waitFor(PLACE, DISCARD) as Promise<PlaceMessage | DiscardMessage>;
  }
}
