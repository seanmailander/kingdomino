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
import { RootState } from "../App/reducer";

type Players = Array<{ playerId: string; isMe: boolean }>;
type PlacedCard = ReturnType<typeof cardPlaced>["payload"];
type CardsPlaced = {
  [playerId: string]: Array<Omit<PlacedCard, "playerId">>;
};
const initialState = {
  players: [] as Players,
  cardsPlacedByPlayer: {} as CardsPlaced,
};

export const gameSlice = createSlice({
  name: "game",
  initialState,
  reducers: {},
  extraReducers: (builder) => {
    builder
      .addCase(playerJoined, (state, action) => {
        const { playerId, isMe } = action.payload;
        state.players.push({ playerId, isMe });
      })
      .addCase(playerLeft, (state, action) => {
        const { playerId } = action.payload;
        state.players = state.players.filter((p) => p.playerId !== playerId);
      })
      .addCase(gameStarted, (state) => {
        state.cardsPlacedByPlayer = {};
        state.players.forEach(
          ({ playerId }) => (state.cardsPlacedByPlayer[playerId] = []),
        );
      })
      .addCase(cardPlaced, (state, action) => {
        const {
          payload: { playerId, card, x, y, direction },
        } = action;
        state.cardsPlacedByPlayer[playerId].push({
          card,
          x,
          y,
          direction,
        });
      })
      .addCase(gameEnded, (state, action) => {
        // TODO: capture current board and score
        state.cardsPlacedByPlayer = {};
      });
  },
});

export const getPlayers = (state: RootState) => state.game.players;
export const getMyPlayerId = createSelector(
  [getPlayers],
  (players) => players?.find((p) => p.isMe)?.playerId,
);
export const getHasEnoughPlayers = createSelector(
  [getPlayers],
  (players) => players.length >= 2,
);

export const getPlayerBoards = (state: RootState) =>
  placedCardsToBoard(state.game.cardsPlacedByPlayer);

export const getPlayerBoard = (playerId: string) => (state: RootState) =>
  placedCardsToBoard(state.game.cardsPlacedByPlayer[playerId]);

export default gameSlice.reducer;
