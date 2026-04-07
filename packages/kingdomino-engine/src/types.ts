import { up, down, left, right } from "./gamelogic/cards";

export type Direction = typeof up | typeof down | typeof left | typeof right;
export type PlayerId = string;
export type CardId = number;
