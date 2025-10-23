import { createSelector, createSlice } from "@reduxjs/toolkit";
import { getHasEnoughPlayers } from "../Game/game.slice";
import { gameEnded, gameStarted, playerJoined } from "../Game/game.actions";
import { getIsMyTurn } from "../Game/round.slice";
import { RootState } from "./reducer";

// States that may occur
export const Splash = "Splash";
export const Lobby = "Lobby";
export const Game = "Game";
export const Shuffle = "Shuffle";
export const Scoring = "Scoring";

type ValidRoom =
  | typeof Splash
  | typeof Lobby
  | typeof Game
  | typeof Shuffle
  | typeof Scoring;

export const appSlice = createSlice({
  name: "app",
  initialState: {
    room: Splash as ValidRoom,
  },
  reducers: {},
  extraReducers: (builder) => {
    builder
      .addCase(playerJoined, (state, action) => {
        if (state.room === Splash) {
          return { room: Lobby };
        }
      })
      .addCase(gameStarted, (state) => {
        if (state.room === Lobby) {
          return { room: Game };
        }
      })
      .addCase(gameEnded, (state) => {
        if (state.room === Game) {
          return { room: Lobby }; // TODO: scoring / game over screen
        }
      });
  },
});

// The function below is called a selector and allows us to select a value from
// the state. Selectors can also be defined inline where they're used instead of
// in the slice file. For example: `useSelector((state) => state.counter.value)`
export const getRoom = (state: RootState) => state.app.room;

const hintsByRoom = {
  [Splash]: "Press any key to start",
  [Lobby]: "Waiting for players",
  [Game]: "Game",
  [Shuffle]: "Shuffling",
  [Scoring]: "",
};
export const getHint = createSelector(
  [getRoom, getHasEnoughPlayers, getIsMyTurn],
  (room, hasEnoughPlayers, isMyTurn) => {
    if (room === Lobby) {
      // Check how many we are waiting for
      if (hasEnoughPlayers) {
        return "Players connected, hit 'ready' to start game";
      }
    }

    if (room === Game) {
      // Whose turn is it?
      if (isMyTurn) {
        return "Pick your card";
      } else {
        return "Waiting for Player 2 to pick their card";
      }
    }
    return hintsByRoom[room];
  },
);
export default appSlice.reducer;
