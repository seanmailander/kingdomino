import app from "./app.slice";
import game from "../Game/game.slice";
import round from "../Game/round.slice";

export const reducer = (state, action) => ({
  app: app(state?.app, action),
  game: game(state?.game, action),
  round: round(state?.round, action),
});

export type RootState = ReturnType<typeof reducer>;

export default reducer;
