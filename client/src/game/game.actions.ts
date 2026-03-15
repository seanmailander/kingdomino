import { Card, MovePayload, PlayerId } from "./types";

export type GameAction<T = unknown> = {
  type: string;
  payload?: T;
};

// Kickoff events
export const START_SOLO = "start/solo";
export const START_MULTI = "start/multi";

export const startSolo = (): GameAction => ({ type: START_SOLO });
export const startMulti = (): GameAction => ({ type: START_MULTI });

// Connection events
export const CONNECTION_RESET = "connection/reset";
export const CONNECTION_CONNECTED = "connection/connected";
export const CONNECTION_ERRORED = "connection/errored";
export const CONNECTION_TIMEOUT = "connection/timeout";

export const connectionReset = (): GameAction => ({ type: CONNECTION_RESET });
export const connectionConnected = (): GameAction => ({ type: CONNECTION_CONNECTED });
export const connectionErrored = (): GameAction => ({ type: CONNECTION_ERRORED });
export const connectionTimeout = (): GameAction => ({ type: CONNECTION_TIMEOUT });

// Lobby events
export const PLAYER_JOINED = "lobby/playerJoined";
export const PLAYER_LEFT = "lobby/playerLeft";

export const playerJoined = (payload: { playerId: PlayerId; isMe: boolean }): GameAction => ({
  type: PLAYER_JOINED,
  payload,
});
export const playerLeft = (payload: { playerId: PlayerId }): GameAction => ({
  type: PLAYER_LEFT,
  payload,
});

// Game events
export const GAME_STARTED = "game/started";
export const ORDER_CHOSEN = "game/orderChosen";
export const GAME_ENDED = "game/ended";

export const gameStarted = (): GameAction => ({ type: GAME_STARTED });
export const orderChosen = (payload: PlayerId[]): GameAction => ({
  type: ORDER_CHOSEN,
  payload,
});
export const gameEnded = (): GameAction => ({ type: GAME_ENDED });

// Round events
export const DECK_SHUFFLED = "round/deckShuffled";
export const CARD_PICKED = "round/cardPicked";
export const CARD_PLACED = "round/cardPlaced";

export const deckShuffled = (payload: Card[]): GameAction => ({
  type: DECK_SHUFFLED,
  payload,
});
export const cardPicked = (payload: Card): GameAction => ({ type: CARD_PICKED, payload });
export const cardPlaced = (payload: MovePayload): GameAction => ({ type: CARD_PLACED, payload });
