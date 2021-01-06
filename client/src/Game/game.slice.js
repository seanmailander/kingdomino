import { createAction, createSlice } from "@reduxjs/toolkit";
import { createSelector } from "reselect";

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

export const gameSlice = createSlice({
  name: "game",
  initialState: {
    players: [],
    events: [],
  },
  extraReducers: {
    [playerJoined]: (state, action) => {
      const { playerId, isMe } = action.payload;
      state.players.push({ playerId, isMe });
    },
    [playerLeft]: (state, action) => {
      const { playerId } = action.payload;
      state.players = state.players.filter((p) => p.playerId !== playerId);
    },
    [gameStarted]: (state) => {
      state.events = [];
    },
    [orderChosen]: (state, action) => {
      state.events.push(action);
    },
    [deckShuffled]: (state, action) => {
      state.events.push(action);
    },
    [cardPicked]: (state, action) => {
      state.events.push(action);
    },
    [cardPlaced]: (state, action) => {
      state.events.push(action);
    },
    [gameEnded]: (state, action) => {
      // TODO: capture current board and score
      state.events = [];
    },
  },
});

export const getPlayers = (state) => state.game.players;
export const getHasEnoughPlayers = createSelector(
  [getPlayers],
  (players) => players.length >= 2
);

export const getIsMyTurn = createSelector([], () => true);

const makeMove = (card, x, y, direction) => ({
  card,
  x,
  y,
  direction,
});

export const getMove = createSelector([], () => makeMove(0, 1, 2, 3));

export default gameSlice.reducer;
