import {
  CARD_PLACED,
  GAME_ENDED,
  GAME_STARTED,
  PLAYER_JOINED,
  PLAYER_LEFT,
  type GameAction,
} from "./game.actions";
import { placedCardsToBoard } from "./gamelogic/board";
import type { Card, Direction, PlayerId } from "./types";

type Players = Array<{ playerId: PlayerId; isMe: boolean }>;
type PlacedCard = {
  card: Card;
  x: number;
  y: number;
  direction: Direction;
};
type CardsPlaced = {
  [playerId: string]: PlacedCard[];
};

export type GameState = {
  players: Players;
  cardsPlacedByPlayer: CardsPlaced;
};

const initialState: GameState = {
  players: [] as Players,
  cardsPlacedByPlayer: {} as CardsPlaced,
};

export type GameSelectorState = {
  game: GameState;
};

type CardPlacedPayload = {
  playerId: PlayerId;
  card: Card;
  x: number;
  y: number;
  direction: Direction;
};

export class Game {
  private state: GameState;

  private constructor(state: GameState) {
    this.state = {
      players: [...state.players],
      cardsPlacedByPlayer: Object.fromEntries(
        Object.entries(state.cardsPlacedByPlayer).map(([playerId, cards]) => [playerId, [...cards]]),
      ),
    };
  }

  static initialState(): GameState {
    return {
      players: [],
      cardsPlacedByPlayer: {},
    };
  }

  static fromState(state: GameState = Game.initialState()): Game {
    return new Game(state);
  }

  static fromSelectorState(state: GameSelectorState): Game {
    return Game.fromState(state.game);
  }

  static gameReducer(state: GameState = initialState, action: GameAction): GameState {
    const game = Game.fromState(state);

    switch (action.type) {
      case PLAYER_JOINED: {
        const payload = action.payload as { playerId: PlayerId; isMe: boolean } | undefined;
        if (!payload) {
          return state;
        }

        return game.joinPlayer(payload.playerId, payload.isMe).getState();
      }
      case PLAYER_LEFT: {
        const payload = action.payload as { playerId: PlayerId } | undefined;
        if (!payload) {
          return state;
        }

        return game.leavePlayer(payload.playerId).getState();
      }
      case GAME_STARTED:
        return game.startGame().getState();
      case CARD_PLACED: {
        const payload = action.payload as CardPlacedPayload | undefined;
        if (!payload) {
          return state;
        }

        return game
          .placeCard(payload.playerId, {
            card: payload.card,
            x: payload.x,
            y: payload.y,
            direction: payload.direction,
          })
          .getState();
      }
      case GAME_ENDED:
        return game.endGame().getState();
      default:
        return state;
    }
  }

  getState(): GameState {
    return {
      players: [...this.state.players],
      cardsPlacedByPlayer: Object.fromEntries(
        Object.entries(this.state.cardsPlacedByPlayer).map(([playerId, cards]) => [
          playerId,
          [...cards],
        ]),
      ),
    };
  }

  joinPlayer(playerId: PlayerId, isMe: boolean): Game {
    this.state.players = [...this.state.players, { playerId, isMe }];
    return this;
  }

  leavePlayer(playerId: PlayerId): Game {
    this.state.players = this.state.players.filter((player) => player.playerId !== playerId);
    return this;
  }

  startGame(): Game {
    this.state.cardsPlacedByPlayer = this.state.players.reduce((acc, { playerId }) => {
      acc[playerId] = [];
      return acc;
    }, {} as CardsPlaced);
    return this;
  }

  placeCard(playerId: PlayerId, placement: PlacedCard): Game {
    const previousPlacements = this.state.cardsPlacedByPlayer[playerId] ?? [];
    this.state.cardsPlacedByPlayer = {
      ...this.state.cardsPlacedByPlayer,
      [playerId]: [...previousPlacements, placement],
    };
    return this;
  }

  endGame(): Game {
    this.state.cardsPlacedByPlayer = {};
    return this;
  }

  players(): Players {
    return [...this.state.players];
  }

  myPlayerId(): PlayerId | undefined {
    return this.state.players.find((player) => player.isMe)?.playerId;
  }

  hasEnoughPlayers(): boolean {
    return this.state.players.length >= 2;
  }

  boards() {
    return placedCardsToBoard(this.state.cardsPlacedByPlayer);
  }

  boardFor(playerId: PlayerId) {
    return placedCardsToBoard(this.state.cardsPlacedByPlayer[playerId]);
  }
}

export default Game.gameReducer;
