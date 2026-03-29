import { up, down, left, right } from "../gamelogic/cards";

export type Direction = typeof up | typeof down | typeof left | typeof right;

export type PlayerId = string;
export type CardId = number;

export type MovePayload = {
  playerId: PlayerId;
  card: CardId;
  x: number;
  y: number;
  direction: Direction;
  discard?: true;
};
