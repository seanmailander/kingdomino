import { type GameAction, GAME_ENDED, GAME_STARTED, PLAYER_JOINED } from "../game/state/events";
import gameReducer, { Game as GameModel, type GameState } from "../game/state/Game";

// States that may occur
export const Splash = "Splash";
export const Lobby = "Lobby";
export const Game = "Game";
export const Shuffle = "Shuffle";
export const Scoring = "Scoring";

export type AppState = {
  room: string;
  game: GameState;
};

export type AppSelectorState = {
  app: AppState;
};

const initialState: AppState = {
  room: Splash,
  game: GameModel.initialState(),
};

export class App {
  private state: AppState;

  private static readonly hintsByRoom: Record<string, string> = {
    [Splash]: "Press any key to start",
    [Lobby]: "Waiting for players",
    [Game]: "Game",
    [Shuffle]: "Shuffling",
  };

  private constructor(state: AppState) {
    this.state = {
      room: state.room,
      game: GameModel.fromState(state.game).getState(),
    };
  }

  static initialState(): AppState {
    return {
      room: Splash,
      game: GameModel.initialState(),
    };
  }

  static fromState(state: AppState = App.initialState()): App {
    return new App(state);
  }

  static fromSelectorState(state: AppSelectorState): App {
    return App.fromState(state.app);
  }

  static appReducer(state: AppState = initialState, action: GameAction): AppState {
    const app = App.fromState(state);
    app.state.game = gameReducer(app.state.game, action);

    switch (action.type) {
      case PLAYER_JOINED:
        return app.onPlayerJoined().stateSnapshot();
      case GAME_STARTED:
        return app.onGameStarted().stateSnapshot();
      case GAME_ENDED:
        return app.onGameEnded().stateSnapshot();
      default:
        return state;
    }
  }

  stateSnapshot(): AppState {
    return {
      room: this.state.room,
      game: GameModel.fromState(this.state.game).getState(),
    };
  }

  onPlayerJoined(): App {
    if (this.state.room === Splash) {
      this.state.room = Lobby;
    }
    return this;
  }

  onGameStarted(): App {
    if (this.state.room === Lobby) {
      this.state.room = Game;
    }
    return this;
  }

  onGameEnded(): App {
    if (this.state.room === Game) {
      this.state.room = Lobby;
    }
    return this;
  }

  game(): GameModel {
    return GameModel.fromState(this.state.game);
  }

  room(): string {
    return this.state.room;
  }

  hint(): string {
    const game = this.game();
    const room = this.room();
    const hasEnoughPlayers = game.hasEnoughPlayers();
    const isMyTurn = game.isMyTurn();

    if (room === Lobby) {
      if (hasEnoughPlayers) {
        return "Players connected, hit 'ready' to start game";
      }
    }

    if (room === Game) {
      if (isMyTurn) {
        return "Pick your card";
      }
      return "Waiting for Player 2 to pick their card";
    }

    return App.hintsByRoom[room];
  }
}

export default App.appReducer;
