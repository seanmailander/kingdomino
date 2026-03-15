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
  playerId: PlayerId;
  card: Card;
  x: number;
  y: number;
  direction: Direction;
};
type CardsPlaced = {
  [playerId: string]: Array<Omit<PlacedCard, "playerId">>;
};

const initialState = {
  players: [] as Players,
  cardsPlacedByPlayer: {} as CardsPlaced,
};

export type GameSelectorState = {
  game: typeof initialState;
};

type CardPlacedPayload = {
  playerId: PlayerId;
  card: Card;
  x: number;
  y: number;
  direction: Direction;
};

export const gameReducer = (state = initialState, action: GameAction) => {
  switch (action.type) {
    case PLAYER_JOINED: {
      const payload = action.payload as { playerId: PlayerId; isMe: boolean } | undefined;
      if (!payload) {
        return state;
      }
      return {
        ...state,
        players: [...state.players, { playerId: payload.playerId, isMe: payload.isMe }],
      };
    }
    case PLAYER_LEFT: {
      const payload = action.payload as { playerId: PlayerId } | undefined;
      if (!payload) {
        return state;
      }
      return {
        ...state,
        players: state.players.filter((p) => p.playerId !== payload.playerId),
      };
    }
    case GAME_STARTED: {
      const cardsPlacedByPlayer = state.players.reduce((acc, { playerId }) => {
        acc[playerId] = [];
        return acc;
      }, {} as CardsPlaced);

      return {
        ...state,
        cardsPlacedByPlayer,
      };
    }
    case CARD_PLACED: {
      const payload = action.payload as CardPlacedPayload | undefined;
      if (!payload) {
        return state;
      }
      const previousPlacements = state.cardsPlacedByPlayer[payload.playerId] ?? [];
      return {
        ...state,
        cardsPlacedByPlayer: {
          ...state.cardsPlacedByPlayer,
          [payload.playerId]: [
            ...previousPlacements,
            {
              card: payload.card,
              x: payload.x,
              y: payload.y,
              direction: payload.direction,
            },
          ],
        },
      };
    }
    case GAME_ENDED:
      return {
        ...state,
        cardsPlacedByPlayer: {},
      };
    default:
      return state;
  }
};

export const getPlayers = (state: GameSelectorState) => state.game.players;
export const getMyPlayerId = (state: GameSelectorState) =>
  getPlayers(state)?.find((p) => p.isMe)?.playerId;
export const getHasEnoughPlayers = (state: GameSelectorState) => getPlayers(state).length >= 2;

export const getPlayerBoards = (state: GameSelectorState) =>
  placedCardsToBoard(state.game.cardsPlacedByPlayer);

export const getPlayerBoard = (playerId: PlayerId) => (state: GameSelectorState) =>
  placedCardsToBoard(state.game.cardsPlacedByPlayer[playerId]);

export default gameReducer;
