import { createAction } from "@reduxjs/toolkit";

// Kickoff events
export const startSolo = createAction("start/solo");
export const startMulti = createAction("start/multi");

// Connection events
export const connectionReset = createAction("connection/reset");
export const connectionConnected = createAction("connection/connected");
export const connectionErrored = createAction("connection/errored");
export const connectionTimeout = createAction("connection/timeout");

// Lobby events
export const playerJoined = createAction("lobby/playerJoined");
export const playerLeft = createAction("lobby/playerLeft");

// Game events
export const gameStarted = createAction("game/started");
export const orderChosen = createAction("game/orderChosen");
export const gameEnded = createAction("game/ended");

// Round events
export const deckShuffled = createAction("round/deckShuffled");
export const cardPicked = createAction("round/cardPicked");
export const cardPlaced = createAction("round/cardPlaced");
