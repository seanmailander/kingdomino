import { type GameAction, GAME_ENDED, GAME_STARTED, PLAYER_JOINED } from "../Game/game.actions";
import { getHasEnoughPlayers } from "../Game/game.slice";
import { getIsMyTurn } from "../Game/round.slice";

// States that may occur
export const Splash = "Splash";
export const Lobby = "Lobby";
export const Game = "Game";
export const Shuffle = "Shuffle";
export const Scoring = "Scoring";

const initialState = {
  room: Splash,
};

export const appReducer = (state = initialState, action: GameAction) => {
  switch (action.type) {
    case PLAYER_JOINED:
      if (state.room === Splash) {
        return { room: Lobby };
      }
      return state;
    case GAME_STARTED:
      if (state.room === Lobby) {
        return { room: Game };
      }
      return state;
    case GAME_ENDED:
      if (state.room === Game) {
        return { room: Lobby };
      }
      return state;
    default:
      return state;
  }
};

// The function below is called a selector and allows us to select a value from
// the state. Selectors can also be defined inline where they're used instead of
// in the slice file. For example: `useSelector((state) => state.counter.value)`
export const getRoom = (state) => state.app.room;

const hintsByRoom = {
  [Splash]: "Press any key to start",
  [Lobby]: "Waiting for players",
  [Game]: "Game",
  [Shuffle]: "Shuffling",
};
export const getHint = (state) => {
  const room = getRoom(state);
  const hasEnoughPlayers = getHasEnoughPlayers(state);
  const isMyTurn = getIsMyTurn(state);

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
    }
    return "Waiting for Player 2 to pick their card";
  }
  return hintsByRoom[room];
};
export default appReducer;
