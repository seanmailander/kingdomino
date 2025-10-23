import {
  down,
  left,
  noCrown,
  oneCrown,
  right,
  threeCrown,
  twoCrown,
  up,
  validTiles,
} from "./gamelogic/cards";

export type PlayerId = string;

export type Card = number;

export type Direction = typeof up | typeof down | typeof left | typeof right;

export type MovePayload = {
  playerId: PlayerId;
  card: Card;
  x: number;
  y: number;
  direction: Direction;
};

export type PeerIdentifiers = {
  me: PlayerId;
  them: PlayerId;
};

export type CardType = (typeof validTiles)[number];

export type CardValue =
  | typeof noCrown
  | typeof oneCrown
  | typeof twoCrown
  | typeof threeCrown;

export type CardInfo = {
  type: number;
  tiles: [
    { tile: CardType; value: CardValue },
    { tile: CardType; value: CardValue },
  ];
};

export type Board = { tile?: CardType; value?: CardValue }[][];

export type Players = Array<{ playerId: PlayerId; isMe: boolean }>;

type GameMessageType<T> = { type: string; content: T };
type SendGameMessageType<T> = (message: GameMessageType<T>) => void;
type WaitForGameMessageType<T> = (type: string) => Promise<T>;
export type GameConnection = {
  destroy: () => void;
  players: Players;
  sendGameMessage: SendGameMessageType<any>;
  waitForGameMessage: WaitForGameMessageType<any>;
};
