import { createSlice } from "@reduxjs/toolkit";
import { createSelector } from "reselect";
import {
  playerJoined,
  playerLeft,
  gameStarted,
  gameEnded,
  cardPlaced,
} from "./game.actions";
import { placedCardsToBoard } from "./gamelogic/board";

export const gameSlice = createSlice({
  name: "game",
  initialState: {
    players: [],
    cardsPlacedByPlayer: {},
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
      state.cardsPlacedByPlayer = {};
      state.players.forEach(
        ({ playerId }) => (state.cardsPlacedByPlayer[playerId] = [])
      );
    },
    [cardPlaced]: (state, action) => {
      const {
        payload: { playerId, card, x, y, direction },
      } = action;
      state.cardsPlacedByPlayer[playerId].push({
        card,
        x,
        y,
        direction,
      });
    },
    [gameEnded]: (state, action) => {
      // TODO: capture current board and score
      state.cardsPlacedByPlayer = {};
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

export const getPlayerBoards = (state) =>
  placedCardsToBoard(state.game.cardsPlacedByPlayer);

export const getPlayerBoard = (playerId) => (state) =>
  placedCardsToBoard(state.game.cardsPlacedByPlayer[playerId]);

export default gameSlice.reducer;
