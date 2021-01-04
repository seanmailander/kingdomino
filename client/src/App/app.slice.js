import { createSlice } from "@reduxjs/toolkit";
import { gameEnded, gameStarted, playerJoined } from "../Game/game.slice";

// States that may occur
export const Splash = "Splash";
export const Lobby = "Lobby";
export const Game = "Game";
export const Scoring = "Scoring";

export const appSlice = createSlice({
  name: "app",
  initialState: {
    room: Splash,
  },
  extraReducers: {
    [playerJoined]: (state, action) => {
      return { room: Lobby };
    },
    [gameStarted]: (state) => {
      return { room: Game };
    },
    [gameEnded]: (state) => {
      return { room: Lobby }; // TODO: scoring / game over screen
    },
  },
});

// The function below is called a selector and allows us to select a value from
// the state. Selectors can also be defined inline where they're used instead of
// in the slice file. For example: `useSelector((state) => state.counter.value)`
export const selectRoom = (state) => state.app.room;

export default appSlice.reducer;
