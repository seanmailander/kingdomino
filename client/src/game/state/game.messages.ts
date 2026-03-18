export const START = "START";
export const COMMITTMENT = "COMMITTMENT";
export const REVEAL = "REVEAL";
export const MOVE = "MOVE";

import type { Direction } from "./types";

export type PlayerMoveMessage = {
  playerId: string;
  card: number;
  x: number;
  y: number;
  direction: Direction;
};

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

// TODO: Add Joi schemas and runtime validation for all incoming/outgoing game messages.
export type GameMessage =
  | StartGameMessage
  | CommittmentGameMessage
  | RevealGameMessage
  | MoveGameMessage;

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
