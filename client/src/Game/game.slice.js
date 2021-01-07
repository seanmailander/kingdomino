import { createSlice } from "@reduxjs/toolkit";
import { createSelector } from "reselect";
import {
  playerJoined,
  playerLeft,
  gameStarted,
  gameEnded,
  cardPlaced,
} from "./game.actions";

export const gameSlice = createSlice({
  name: "game",
  initialState: {
    players: [],
    playerBoards: {},
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
      state.playerBoards = {};
      state.players.forEach(
        ({ playerId }) => (state.playerBoards[playerId] = [])
      );
    },
    [cardPlaced]: (state, action) => {
      const {
        payload: { playerId, card, x, y, direction },
      } = action;
      state.playerBoards[playerId].push({
        card,
        x,
        y,
        direction,
      });
    },
    [gameEnded]: (state, action) => {
      // TODO: capture current board and score
      state.playerBoards = {};
    },
  },
});

export const getPlayers = (state) => state.game.players;
export const getMyPlayerId = createSelector(
  [getPlayers],
  (players) => players?.find((p) => p.isMe)?.playerId
);
export const getHasEnoughPlayers = createSelector(
  [getPlayers],
  (players) => players.length >= 2
);

export const getPlayerBoards = (state) => state.game.playerBoards;

export default gameSlice.reducer;
