export const START = "START";
export const COMMITTMENT = "COMMITTMENT";
export const REVEAL = "REVEAL";
export const MOVE = "MOVE";
export const PAUSE_REQUEST = "CONTROL_PAUSE_REQUEST";
export const PAUSE_ACK = "CONTROL_PAUSE_ACK";
export const RESUME_REQUEST = "CONTROL_RESUME_REQUEST";
export const RESUME_ACK = "CONTROL_RESUME_ACK";
export const EXIT_REQUEST = "CONTROL_EXIT_REQUEST";
export const EXIT_ACK = "CONTROL_EXIT_ACK";

import type { MovePayload } from "./types";

export type PlayerMoveMessage = MovePayload;

export type StartGameMessage = {
  type: typeof START;
};

export type CommittmentGameMessage = {
  type: typeof COMMITTMENT;
  content: { committment: string };
};

export type RevealGameMessage = {
  type: typeof REVEAL;
  content: { secret: string | number };
};

export type MoveGameMessage = {
  type: typeof MOVE;
  content: { move: PlayerMoveMessage };
};

export type PauseRequestMessage = { type: typeof PAUSE_REQUEST };
export type PauseAckMessage = { type: typeof PAUSE_ACK };
export type ResumeRequestMessage = { type: typeof RESUME_REQUEST };
export type ResumeAckMessage = { type: typeof RESUME_ACK };
export type ExitRequestMessage = { type: typeof EXIT_REQUEST };
export type ExitAckMessage = { type: typeof EXIT_ACK };

// TODO: Add Joi schemas and runtime validation for all incoming/outgoing game messages.
export type GameMessage =
  | StartGameMessage
  | CommittmentGameMessage
  | RevealGameMessage
  | MoveGameMessage
  | PauseRequestMessage
  | PauseAckMessage
  | ResumeRequestMessage
  | ResumeAckMessage
  | ExitRequestMessage
  | ExitAckMessage;

export type GameMessageType = GameMessage["type"];
export type GameMessagePayload<T extends GameMessageType> =
  Extract<GameMessage, { type: T }> extends { content: infer C } ? C : undefined;

export const startMessage = (): StartGameMessage => ({ type: START });
export const committmentMessage = (committment: string): CommittmentGameMessage => ({
  type: COMMITTMENT,
  content: { committment },
});
export const revealMessage = (secret: string | number): RevealGameMessage => ({
  type: REVEAL,
  content: { secret },
});
export const moveMessage = (move: PlayerMoveMessage): MoveGameMessage => ({
  type: MOVE,
  content: { move },
});

export const pauseRequestMessage = (): PauseRequestMessage => ({ type: PAUSE_REQUEST });
export const pauseAckMessage = (): PauseAckMessage => ({ type: PAUSE_ACK });
export const resumeRequestMessage = (): ResumeRequestMessage => ({ type: RESUME_REQUEST });
export const resumeAckMessage = (): ResumeAckMessage => ({ type: RESUME_ACK });
export const exitRequestMessage = (): ExitRequestMessage => ({ type: EXIT_REQUEST });
export const exitAckMessage = (): ExitAckMessage => ({ type: EXIT_ACK });
