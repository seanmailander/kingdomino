import { createAction } from "@reduxjs/toolkit";
import { Card, MovePayload, PlayerId } from "./types";

// Kickoff events
export const startSolo = createAction("start/solo");
export const startMulti = createAction("start/multi");

// Connection events
export const connectionReset = createAction("connection/reset");
export const connectionConnected = createAction("connection/connected");
export const connectionErrored = createAction("connection/errored");
export const connectionTimeout = createAction("connection/timeout");

// Lobby events
export const playerJoined = createAction<{ playerId: PlayerId; isMe: boolean }>(
  "lobby/playerJoined",
);
export const playerLeft = createAction<{ playerId: PlayerId }>("lobby/playerLeft");

// Game events
export const gameStarted = createAction("game/started");
export const orderChosen = createAction<PlayerId[]>("game/orderChosen");
export const gameEnded = createAction("game/ended");

// Round events
export const deckShuffled = createAction<Card[]>("round/deckShuffled");
export const cardPicked = createAction<Card>("round/cardPicked");
export const cardPlaced = createAction<MovePayload>("round/cardPlaced");
