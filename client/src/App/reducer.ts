import { combineReducers } from "redux";

import app from "./app.slice";
import game from "../Game/game.slice";
import round from "../Game/round.slice";

const reducer = combineReducers({
  app,
  game,
  round,
});

export type RootState = ReturnType<typeof reducer>

export default reducer;
