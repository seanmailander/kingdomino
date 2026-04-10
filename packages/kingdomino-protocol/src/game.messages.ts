import type { PlayerId, CardId, Direction } from "kingdomino-engine";
import { PICK_MADE, PLACE_MADE, DISCARD_MADE } from "kingdomino-engine";

// ── Move messages (player actions over the wire) ──────────────────────────────

export const PICK    = PICK_MADE;
export const PLACE   = PLACE_MADE;
export const DISCARD = DISCARD_MADE;

export type PickMessage    = { type: typeof PICK;    playerId: PlayerId; cardId: CardId };
export type PlaceMessage   = { type: typeof PLACE;   playerId: PlayerId; x: number; y: number; direction: Direction };
export type DiscardMessage = { type: typeof DISCARD; playerId: PlayerId };
export type MoveMessage    = PickMessage | PlaceMessage | DiscardMessage;

// ── Control messages (session control over the wire) ─────────────────────────

export const START          = "START";
export const COMMITTMENT    = "COMMITTMENT";
export const REVEAL         = "REVEAL";
export const PAUSE_REQUEST  = "CONTROL_PAUSE_REQUEST";
export const PAUSE_ACK      = "CONTROL_PAUSE_ACK";
export const RESUME_REQUEST = "CONTROL_RESUME_REQUEST";
export const RESUME_ACK     = "CONTROL_RESUME_ACK";
export const EXIT_REQUEST   = "CONTROL_EXIT_REQUEST";
export const EXIT_ACK       = "CONTROL_EXIT_ACK";

export type StartGameMessage       = { type: typeof START };
export type CommittmentGameMessage = { type: typeof COMMITTMENT; content: { committment: string } };
export type RevealGameMessage      = { type: typeof REVEAL;      content: { secret: string | number } };
export type PauseRequestMessage    = { type: typeof PAUSE_REQUEST };
export type PauseAckMessage        = { type: typeof PAUSE_ACK };
export type ResumeRequestMessage   = { type: typeof RESUME_REQUEST };
export type ResumeAckMessage       = { type: typeof RESUME_ACK };
export type ExitRequestMessage     = { type: typeof EXIT_REQUEST };
export type ExitAckMessage         = { type: typeof EXIT_ACK };

export type ControlMessage =
  | StartGameMessage | CommittmentGameMessage | RevealGameMessage
  | PauseRequestMessage | PauseAckMessage
  | ResumeRequestMessage | ResumeAckMessage
  | ExitRequestMessage | ExitAckMessage;

export type WireMessage = MoveMessage | ControlMessage;
export type WireMessageType = WireMessage["type"];

/**
 * The value stored/returned by waitFor() for a given message type:
 * - Messages with a `content` field → the content object (keeps CommitmentSeedProvider compatible)
 * - All other messages → the full message object
 */
export type WireMessagePayload<T extends WireMessageType> =
  Extract<WireMessage, { type: T }> extends { content: infer C } ? C : Extract<WireMessage, { type: T }>;

// ── Factory helpers ──────────────────────────────────────────────────────────

export const pickMessage    = (playerId: PlayerId, cardId: CardId): PickMessage    => ({ type: PICK, playerId, cardId });
export const placeMessage   = (playerId: PlayerId, x: number, y: number, direction: Direction): PlaceMessage => ({ type: PLACE, playerId, x, y, direction });
export const discardMessage = (playerId: PlayerId): DiscardMessage => ({ type: DISCARD, playerId });

export const committmentMessage = (committment: string): CommittmentGameMessage => ({ type: COMMITTMENT, content: { committment } });
export const revealMessage      = (secret: string | number): RevealGameMessage  => ({ type: REVEAL, content: { secret } });

export const pauseRequestMessage  = (): PauseRequestMessage  => ({ type: PAUSE_REQUEST });
export const pauseAckMessage      = (): PauseAckMessage      => ({ type: PAUSE_ACK });
export const resumeRequestMessage = (): ResumeRequestMessage => ({ type: RESUME_REQUEST });
export const resumeAckMessage     = (): ResumeAckMessage     => ({ type: RESUME_ACK });
export const exitRequestMessage   = (): ExitRequestMessage   => ({ type: EXIT_REQUEST });
export const exitAckMessage       = (): ExitAckMessage       => ({ type: EXIT_ACK });
