import { createAction } from "@reduxjs/toolkit";
import { Card, Direction, PeerIdentifiers, PlayerId } from "./types";

// Kickoff events
export const startSolo = createAction("start/solo");
export const startMulti = createAction("start/multi");

// Connection events
export const connectionReset = createAction("connection/reset");
export const connectionConnected = createAction("connection/connected");
export const connectionErrored = createAction("connection/errored");
export const connectionTimeout = createAction("connection/timeout");

// Lobby events
export const playerJoined = createAction<{ playerId: string; isMe: boolean }>(
  "lobby/playerJoined",
);
export const playerLeft = createAction<{ playerId: string }>(
  "lobby/playerLeft",
);

// Game events
export const gameStarted = createAction("game/started");
export const orderChosen = createAction<string[]>("game/orderChosen");
export const gameEnded = createAction("game/ended");

// Round events
export const deckShuffled = createAction<Card[]>("round/deckShuffled");
export const cardPicked = createAction("round/cardPicked");
export const cardPlaced = createAction<{
  playerId: PlayerId;
  card: Card;
  x: string;
  y: string;
  direction: Direction;
}>("round/cardPlaced");
