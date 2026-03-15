import { App, type AppState } from "./app.slice";
import game, { Game, type GameState } from "../Game/game.slice";
import Round from "../Game/Round";
import type { RoundState } from "../Game/Round";
import type { GameAction } from "../Game/game.actions";

export type RootState = {
  app: AppState;
  game: GameState;
  round: RoundState;
};

export class Root {
  private state: RootState;

  private constructor(state: RootState) {
    this.state = {
      app: { ...state.app },
      game: Game.fromState(state.game).getState(),
      round: Round.fromState(state.round).stateSnapshot(),
    };
  }

  static initialState(): RootState {
    return {
      app: App.initialState(),
      game: Game.initialState(),
      round: Round.initialState(),
    };
  }

  static fromState(state: RootState = Root.initialState()): Root {
    return new Root(state);
  }

  static reduce(state: RootState = Root.initialState(), action: GameAction): RootState {
    return Root.fromState(state).apply(action).stateSnapshot();
  }

  apply(action: GameAction): Root {
    this.state = {
      app: App.appReducer(this.state.app, action),
      game: game(this.state.game, action),
      round: Round.roundReducer(this.state.round, action),
    };

    return this;
  }

  stateSnapshot(): RootState {
    return {
      app: { ...this.state.app },
      game: Game.fromState(this.state.game).getState(),
      round: Round.fromState(this.state.round).stateSnapshot(),
    };
  }

  app(): App {
    return App.fromState(this.state.app);
  }

  game(): Game {
    return Game.fromState(this.state.game);
  }

  round(): Round {
    return Round.fromState(this.state.round);
  }
}

export const reducer = (state: RootState | undefined, action: GameAction) =>
  Root.reduce(state, action);


export default reducer;
