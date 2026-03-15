import { placedCardsToBoard } from "../gamelogic/board";
import Round, {
  MY_PICK,
  MY_PLACE,
  ROUND_END,
  ROUND_START,
  THEIR_PICK,
  THEIR_PLACE,
  WHOSE_TURN,
  ORDER_CHOSEN,
  DECK_SHUFFLED,
  CARD_PICKED,
  CARD_PLACED,
  type RoundState,
} from "./Round";
import type { Card, Direction, GameAction, PlayerId } from "./types";

// Player events
export const PLAYER_JOINED = "lobby/playerJoined";
export const PLAYER_LEFT = "lobby/playerLeft";
// Game lifecycle events
export const GAME_STARTED = "game/started";
export const GAME_ENDED = "game/ended";

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
  round?: RoundState;
};

const initialState: GameState = {
  players: [] as Players,
  cardsPlacedByPlayer: {} as CardsPlaced,
  round: undefined,
};

export type GameSelectorState = {
  app: {
    game: GameState;
  };
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
      round: state.round ? Round.fromState(state.round).stateSnapshot() : undefined,
    };
  }

  static initialState(): GameState {
    return {
      players: [],
      cardsPlacedByPlayer: {},
      round: undefined,
    };
  }

  static fromState(state: GameState = Game.initialState()): Game {
    return new Game(state);
  }

  static fromSelectorState(state: GameSelectorState): Game {
    return Game.fromState(state.app.game);
  }

  static playerJoined(payload: { playerId: PlayerId; isMe: boolean }): GameAction {
    return { type: PLAYER_JOINED, payload };
  }

  static playerLeft(payload: { playerId: PlayerId }): GameAction {
    return { type: PLAYER_LEFT, payload };
  }

  static gameStarted(): GameAction {
    return { type: GAME_STARTED };
  }

  static gameEnded(): GameAction {
    return { type: GAME_ENDED };
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
        return game.startGame().reduceRound(action).getState();
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
          .reduceRound(action)
          .getState();
      }
      case GAME_ENDED:
        return game.endGame().reduceRound(action).getState();
      default:
        return game.reduceRound(action).getState();
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
      round: this.state.round ? Round.fromState(this.state.round).stateSnapshot() : undefined,
    };
  }

  reduceRound(action: GameAction): Game {
    const shouldInstantiateRound = [
      ROUND_START,
      WHOSE_TURN,
      MY_PICK,
      MY_PLACE,
      THEIR_PICK,
      THEIR_PLACE,
      ROUND_END,
      ORDER_CHOSEN,
      DECK_SHUFFLED,
      CARD_PICKED,
      CARD_PLACED,
    ].includes(action.type);

    if (!this.state.round && !shouldInstantiateRound) {
      return this;
    }

    const currentRound = this.state.round ?? Round.initialState();
    this.state.round = Round.roundReducer(currentRound, action);
    return this;
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
    this.state.round = undefined;
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

  round(): Round | undefined {
    if (!this.state.round) {
      return undefined;
    }

    return Round.fromState(this.state.round);
  }

  pickOrder(): Array<PlayerId | undefined> {
    return this.round()?.pickOrder() ?? [];
  }

  cardToPlace(): Card | undefined {
    return this.round()?.cardToPlace();
  }

  deal() {
    return this.round()?.deal() ?? [];
  }

  isMyTurn(): boolean {
    return this.round()?.isMyTurn(this.myPlayerId()) ?? false;
  }

  isMyPlace(): boolean {
    return this.round()?.isMyPlace(this.myPlayerId()) ?? false;
  }
}

export default Game.gameReducer;
