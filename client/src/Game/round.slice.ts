import {
  CARD_PICKED,
  CARD_PLACED,
  DECK_SHUFFLED,
  ORDER_CHOSEN,
  type GameAction,
} from "./game.actions";
import { getCard } from "./gamelogic/cards";
import type { GameSelectorState } from "./game.slice";
import { getMyPlayerId } from "./game.slice";
import type { Card, PlayerId } from "./types";

type RoundState = {
  phase: string;
  deal: Array<Card | undefined>;
  pickOrderThisRound: Array<PlayerId | undefined>;
  pickOrderNextRound: Array<PlayerId | undefined>;
  cardToPlace: Card | undefined;
};

// Round phases
export const ROUND_START = "round-phase/start";
export const WHOSE_TURN = "round-phase/whoseTurn";
export const MY_PICK = "round-phase/myPick";
export const MY_PLACE = "round-phase/myPlace";
export const THEIR_PICK = "round-phase/theirPick";
export const THEIR_PLACE = "round-phase/theirPlace";
export const ROUND_END = "round-phase/end";

export const roundStart = (): GameAction => ({ type: ROUND_START });
export const whoseTurn = (): GameAction => ({ type: WHOSE_TURN });
export const myPick = (): GameAction => ({ type: MY_PICK });
export const myPlace = (): GameAction => ({ type: MY_PLACE });
export const theirPick = (): GameAction => ({ type: THEIR_PICK });
export const theirPlace = (): GameAction => ({ type: THEIR_PLACE });
export const roundEnd = (): GameAction => ({ type: ROUND_END });

const initialState: RoundState = {
  phase: ROUND_START,
  deal: [],
  pickOrderThisRound: [],
  pickOrderNextRound: [],
  cardToPlace: undefined,
};

type RoundSelectorState = GameSelectorState & {
  round: RoundState;
};

const buildFreshRound = (): RoundState => ({
  phase: ROUND_START,
  deal: [],
  pickOrderThisRound: [undefined, undefined, undefined, undefined],
  pickOrderNextRound: [undefined, undefined, undefined, undefined],
  cardToPlace: undefined,
});

const asPlayerIdArray = (value: unknown): Array<PlayerId | undefined> =>
  (Array.isArray(value) ? value : []) as Array<PlayerId | undefined>;

export const roundReducer = (state: RoundState = initialState, action: GameAction): RoundState => {
  switch (action.type) {
    case ROUND_START:
      return buildFreshRound();
    case WHOSE_TURN:
      return { ...state, phase: WHOSE_TURN };
    case MY_PICK:
      return { ...state, phase: MY_PICK };
    case MY_PLACE:
      return { ...state, phase: MY_PLACE };
    case THEIR_PICK:
      return { ...state, phase: THEIR_PICK };
    case THEIR_PLACE:
      return { ...state, phase: THEIR_PLACE };
    case ORDER_CHOSEN:
      return {
        ...state,
        pickOrderThisRound: asPlayerIdArray(action.payload),
      };
    case DECK_SHUFFLED:
      return {
        ...state,
        deal: (Array.isArray(action.payload) ? action.payload : []) as Array<Card | undefined>,
        cardToPlace: undefined,
      };
    case CARD_PICKED:
      return {
        ...state,
        cardToPlace: action.payload as Card | undefined,
      };
    case CARD_PLACED: {
      const payload = action.payload as { card?: Card } | undefined;
      const card = payload?.card;
      const placeInDeal = state.deal.findIndex((c) => c === card);
      const nextDeal = [...state.deal];
      const nextPickOrderThisRound = [...state.pickOrderThisRound];
      const nextPickOrderNextRound = [...state.pickOrderNextRound];

      if (placeInDeal >= 0) {
        nextDeal[placeInDeal] = undefined;
      }

      const playerId = nextPickOrderThisRound.shift();
      if (placeInDeal >= 0) {
        nextPickOrderNextRound[placeInDeal] = playerId;
      }

      return {
        ...state,
        cardToPlace: undefined,
        deal: nextDeal,
        pickOrderThisRound: nextPickOrderThisRound,
        pickOrderNextRound: nextPickOrderNextRound,
      };
    }
    case ROUND_END:
      return {
        ...state,
        phase: ROUND_END,
        pickOrderThisRound: state.pickOrderNextRound.filter((p) => !!p),
        pickOrderNextRound: [undefined, undefined, undefined, undefined],
      };
    default:
      return state;
  }
};

export const getPickOrder = (state: RoundSelectorState) => state.round.pickOrderThisRound;

const getPhase = (state: RoundSelectorState) => state.round.phase;
export const getIsMyTurn = (state: RoundSelectorState) => {
  const pickOrder = getPickOrder(state);
  const myPlayerId = getMyPlayerId(state);
  return pickOrder[0] === myPlayerId;
};

export const getIsMyPlace = (state: RoundSelectorState) => {
  const isMyTurn = getIsMyTurn(state);
  const phase = getPhase(state);
  return isMyTurn && phase === MY_PLACE;
};

export const getCardToPlace = (state: RoundSelectorState) => state.round.cardToPlace;

export const getDeal = (state: RoundSelectorState) => state.round.deal.map(getCard);

export default roundReducer;
