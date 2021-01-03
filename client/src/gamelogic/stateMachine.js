import { Machine, interpret, assign } from "xstate";

// - both A and B calculate sorted deck

// - each 4-draw, recommit and re-shuffle
//   - important to re-randomize every turn, or future knowledge will help mis-behaving clients

export const CONNECTION_ERROR = { type: "CONNECTION_ERROR" };
export const RESET_CONNECTIONS = "RESET_CONNECTIONS";
export const INITIALIZE_GAME = "INITIALIZE_GAME";
export const SHUFFLE_DECK = "SHUFFLE_DECK";
export const END_GAME = "END_GAME";

export const gameMachine = Machine({
  id: "game",
  context: { peerName: undefined, error: undefined },
  initial: "Initial",
  states: {
    Initial: {
      on: {
        RESET_CONNECTIONS: {
          target: "Lobby",
        },
        CONNECTION_ERROR: "Error",
      },
    },
    Lobby: {
      on: { INITIALIZE_GAME: { target: "Game" }, CONNECTION_ERROR: "Error" },
    },
    Game: {
      on: { SHUFFLE_DECK: { target: "Round" }, CONNECTION_ERROR: "Error" },
    },
    Round: {
      on: { END_GAME: { target: "GameOver" }, CONNECTION_ERROR: "Error" },
    },
    GameOver: { type: "final" },
    Error: { type: "final" },
  },
});
