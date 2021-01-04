import { combineReducers } from "redux";

import app from "./app.slice";
import game from "../Game/game.slice";

const reducer = combineReducers({
  app,
  game,
});

export default reducer;
