import { createSlice } from "@reduxjs/toolkit";

// Events that occur during the game
export const CONNECTION_ERRORED = "CONNECTION_ERRORED";
export const CONNECTION_RESET = "CONNECTION_RESET";
export const CONNECTION_TIMEOUT = "CONNECTION_TIMEOUT";

export const PLAYER_JOINED = "PLAYER_JOINED";
export const PLAYER_LEFT = "PLAYER_LEFT";
export const GAME_STARTED = "GAME_STARTED";
export const DECK_SHUFFLED = "DECK_SHUFFLED";
export const CARD_PICKED = "CARD_PICKED";
export const CARD_PLACED = "CARD_PLACED";
export const GAME_ENDED = "GAME_ENDED";

// States that may occur
export const Splash = "Splash";
export const Lobby = "Lobby";
export const Game = "Game";

export const appSlice = createSlice({
  name: "app",
  initialState: {
    room: Splash,
  },
  extraReducers: {
    [PLAYER_JOINED]: (state, action) => {
      return { room: Lobby };
    },
    [GAME_STARTED]: (state) => {
      return { room: Game };
    },
    [GAME_ENDED]: (state) => {
      return { room: Lobby };
    },
  },
});

// The function below is called a selector and allows us to select a value from
// the state. Selectors can also be defined inline where they're used instead of
// in the slice file. For example: `useSelector((state) => state.counter.value)`
export const selectRoom = (state) => state.app.room;

export default appSlice.reducer;
