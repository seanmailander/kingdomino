import { createSlice } from "@reduxjs/toolkit";

// Events that occur during the game
export const CONNECTION_ERRORED = "CONNECTION_ERRORED";
export const CONNECTION_RESET = "CONNECTION_RESET";
export const CONNECTION_TIMEOUT = "CONNECTION_TIMEOUT";
export const GAME_STARTED = "GAME_STARTED";
export const DECK_SHUFFLED = "DECK_SHUFFLED";
export const CARD_PICKED = "CARD_PICKED";
export const CARD_PLACED = "CARD_PLACED";
export const GAME_ENDED = "GAME_ENDED";

export const gameSlice = createSlice({
  name: "game",
  initialState: {
    value: 0,
  },
  reducers: {
    increment: (state) => {
      state.value += 1;
    },
    decrement: (state) => {
      state.value -= 1;
    },
    incrementByAmount: (state, action) => {
      state.value += action.payload;
    },
  },
});

export const { increment, decrement, incrementByAmount } = gameSlice.actions;

// The function below is called a thunk and allows us to perform async logic. It
// can be dispatched like a regular action: `dispatch(incrementAsync(10))`. This
// will call the thunk with the `dispatch` function as the first argument. Async
// code can then be executed and other actions can be dispatched
export const incrementAsync = (amount) => (dispatch) => {
  setTimeout(() => {
    dispatch(incrementByAmount(amount));
  }, 1000);
};

export default gameSlice.reducer;
