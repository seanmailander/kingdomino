import { Machine, interpret, assign } from "xstate";

// - both A and B calculate sorted deck

// - each 4-draw, recommit and re-shuffle
//   - important to re-randomize every turn, or future knowledge will help mis-behaving clients

// Events that occur during the game
export const CONNECTION_ERRORED = "CONNECTION_ERRORED";
export const CONNECTION_RESET = "CONNECTION_RESET";
export const CONNECTION_TIMEOUT = "CONNECTION_TIMEOUT";
export const GAME_STARTED = "GAME_STARTED";
export const DECK_SHUFFLED = "DECK_SHUFFLED";
export const CARD_PICKED = "CARD_PICKED";
export const CARD_PLACED = "CARD_PLACED";
export const GAME_ENDED = "GAME_ENDED";

export const gameMachine = Machine({
  id: "game",
  context: { peerName: undefined, error: undefined },
  initial: "Initial",
  states: {
    Initial: {
      on: {
        [CONNECTION_RESET]: "Lobby",
        [CONNECTION_ERRORED]: "Error",
      },
    },
    Lobby: {
      on: {
        [CONNECTION_RESET]: "Lobby",
        [GAME_STARTED]: {
          target: "Game",
          actions: assign({ peerName: (context, event) => event.value }),
        },
        [CONNECTION_ERRORED]: "Error",
      },
    },
    Game: {
      on: {
        [DECK_SHUFFLED]: { target: "Round" },
        [CONNECTION_ERRORED]: "Error",
      },
    },
    Round: {
      on: {
        [GAME_ENDED]: { target: "GameOver" },
        [CONNECTION_ERRORED]: "Error",
      },
    },
    GameOver: { type: "final" },
    Error: { type: "final" },
  },
});
