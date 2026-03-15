import { App, type AppState } from "./app.slice";
import type { GameAction } from "../game/state/game.actions";

export type RootState = {
  app: AppState;
};

export class Root {
  private state: RootState;

  private constructor(state: RootState) {
    this.state = {
      app: App.fromState(state.app).stateSnapshot(),
    };
  }

  static initialState(): RootState {
    return {
      app: App.initialState(),
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
    };

    return this;
  }

  stateSnapshot(): RootState {
    return {
      app: App.fromState(this.state.app).stateSnapshot(),
    };
  }

  app(): App {
    return App.fromState(this.state.app);
  }
}

export const reducer = (state: RootState | undefined, action: GameAction) =>
  Root.reduce(state, action);


export default reducer;
