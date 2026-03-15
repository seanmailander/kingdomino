import {
  CARD_PICKED,
  CARD_PLACED,
  DECK_SHUFFLED,
  ORDER_CHOSEN,
  type GameAction,
} from "./game.actions";
import { computed, signal } from "alien-signals";
import { getCard } from "../gamelogic/cards";
import type { GameSelectorState } from "./game.slice";
import { Game } from "./game.slice";
import type { Card, PlayerId } from "./types";

export type RoundState = {
  phase: string;
  deal: Array<Card | undefined>;
  pickOrderThisRound: Array<PlayerId | undefined>;
  pickOrderNextRound: Array<PlayerId | undefined>;
  cardToPlace: Card | undefined;
};

export const ROUND_START = "round-phase/start";
export const WHOSE_TURN = "round-phase/whoseTurn";
export const MY_PICK = "round-phase/myPick";
export const MY_PLACE = "round-phase/myPlace";
export const THEIR_PICK = "round-phase/theirPick";
export const THEIR_PLACE = "round-phase/theirPlace";
export const ROUND_END = "round-phase/end";

const EMPTY_PICK_ORDER: Array<PlayerId | undefined> = [undefined, undefined, undefined, undefined];

const asPlayerIdArray = (value: unknown): Array<PlayerId | undefined> =>
  (Array.isArray(value) ? [...value] : []) as Array<PlayerId | undefined>;

const asDealArray = (value: unknown): Array<Card | undefined> =>
  (Array.isArray(value) ? [...value] : []) as Array<Card | undefined>;

export class Round {
  private state: RoundState;

  private static readonly defaultState: RoundState = Round.initialState();

  private static readonly reducerByActionType: Partial<Record<string, RoundReducerSignal>> = {
    [ROUND_START]: (round) => round.start(),
    [WHOSE_TURN]: (round) => round.setWhoseTurn(),
    [MY_PICK]: (round) => round.setMyPick(),
    [MY_PLACE]: (round) => round.setMyPlace(),
    [THEIR_PICK]: (round) => round.setTheirPick(),
    [THEIR_PLACE]: (round) => round.setTheirPlace(),
    [ORDER_CHOSEN]: (round, payload) => round.chooseOrder(payload),
    [DECK_SHUFFLED]: (round, payload) => round.shuffleDeck(payload),
    [CARD_PICKED]: (round, payload) => round.pickCard(payload),
    [CARD_PLACED]: (round, payload) => round.placeCard(payload),
    [ROUND_END]: (round) => round.end(),
  };

  private static readonly roundSignal = signal<Round | undefined>();
  private static readonly payloadSignal = signal<unknown>(undefined);
  private static readonly reducerSignal = signal<RoundReducerSignal | undefined>();

  private static readonly reducedRoundState = computed<RoundState | undefined>(() => {
    const reducer = Round.reducerSignal();
    const round = Round.roundSignal();

    if (!reducer || !round) {
      return undefined;
    }

    return reducer(round, Round.payloadSignal()).stateSnapshot();
  });

  private constructor(state: RoundState) {
    this.state = {
      phase: state.phase,
      deal: [...state.deal],
      pickOrderThisRound: [...state.pickOrderThisRound],
      pickOrderNextRound: [...state.pickOrderNextRound],
      cardToPlace: state.cardToPlace,
    };
  }

  static initialState(): RoundState {
    return {
      phase: ROUND_START,
      deal: [],
      pickOrderThisRound: [],
      pickOrderNextRound: [],
      cardToPlace: undefined,
    };
  }

  static fromState(state: RoundState = Round.initialState()): Round {
    return new Round(state);
  }

  static roundStart(): GameAction {
    return { type: ROUND_START };
  }

  static whoseTurn(): GameAction {
    return { type: WHOSE_TURN };
  }

  static myPick(): GameAction {
    return { type: MY_PICK };
  }

  static myPlace(): GameAction {
    return { type: MY_PLACE };
  }

  static theirPick(): GameAction {
    return { type: THEIR_PICK };
  }

  static theirPlace(): GameAction {
    return { type: THEIR_PLACE };
  }

  static roundEnd(): GameAction {
    return { type: ROUND_END };
  }

  static roundReducer(state: RoundState = Round.defaultState, action: GameAction): RoundState {
    const reducer = Round.reducerByActionType[action.type];

    if (!reducer) {
      return state;
    }

    Round.roundSignal(Round.fromState(state));
    Round.payloadSignal(action.payload);
    Round.reducerSignal(reducer);

    return Round.reducedRoundState() ?? state;
  }

  static fromSelectorState(state: GameSelectorState): Round | undefined {
    return Game.fromSelectorState(state).round();
  }

  static pickOrder(state: GameSelectorState): Array<PlayerId | undefined> {
    return Game.fromSelectorState(state).pickOrder();
  }

  static isMyTurn(state: GameSelectorState): boolean {
    return Game.fromSelectorState(state).isMyTurn();
  }

  static isMyPlace(state: GameSelectorState): boolean {
    return Game.fromSelectorState(state).isMyPlace();
  }

  static cardToPlace(state: GameSelectorState): Card | undefined {
    return Game.fromSelectorState(state).cardToPlace();
  }

  static deal(state: GameSelectorState) {
    return Game.fromSelectorState(state).deal();
  }

  stateSnapshot(): RoundState {
    return {
      phase: this.state.phase,
      deal: [...this.state.deal],
      pickOrderThisRound: [...this.state.pickOrderThisRound],
      pickOrderNextRound: [...this.state.pickOrderNextRound],
      cardToPlace: this.state.cardToPlace,
    };
  }

  start(): Round {
    this.state = {
      phase: ROUND_START,
      deal: [],
      pickOrderThisRound: [...EMPTY_PICK_ORDER],
      pickOrderNextRound: [...EMPTY_PICK_ORDER],
      cardToPlace: undefined,
    };
    return this;
  }

  setWhoseTurn(): Round {
    this.state.phase = WHOSE_TURN;
    return this;
  }

  setMyPick(): Round {
    this.state.phase = MY_PICK;
    return this;
  }

  setMyPlace(): Round {
    this.state.phase = MY_PLACE;
    return this;
  }

  setTheirPick(): Round {
    this.state.phase = THEIR_PICK;
    return this;
  }

  setTheirPlace(): Round {
    this.state.phase = THEIR_PLACE;
    return this;
  }

  chooseOrder(payload: unknown): Round {
    this.state.pickOrderThisRound = asPlayerIdArray(payload);
    return this;
  }

  shuffleDeck(payload: unknown): Round {
    this.state.deal = asDealArray(payload);
    this.state.cardToPlace = undefined;
    return this;
  }

  pickCard(payload: unknown): Round {
    this.state.cardToPlace = payload as Card | undefined;
    return this;
  }

  placeCard(payload: unknown): Round {
    const card = (payload as { card?: Card } | undefined)?.card;
    const placeInDeal = this.state.deal.findIndex((c) => c === card);

    if (placeInDeal >= 0) {
      this.state.deal[placeInDeal] = undefined;
    }

    const playerId = this.state.pickOrderThisRound.shift();
    if (placeInDeal >= 0) {
      this.state.pickOrderNextRound[placeInDeal] = playerId;
    }

    this.state.cardToPlace = undefined;
    return this;
  }

  end(): Round {
    this.state.phase = ROUND_END;
    this.state.pickOrderThisRound = this.state.pickOrderNextRound.filter(
      (playerId) => !!playerId,
    );
    this.state.pickOrderNextRound = [...EMPTY_PICK_ORDER];
    return this;
  }

  pickOrder(): Array<PlayerId | undefined> {
    return [...this.state.pickOrderThisRound];
  }

  cardToPlace(): Card | undefined {
    return this.state.cardToPlace;
  }

  phase(): string {
    return this.state.phase;
  }

  deal() {
    return this.state.deal.map(getCard);
  }

  isMyTurn(playerId: PlayerId | undefined): boolean {
    return this.state.pickOrderThisRound[0] === playerId;
  }

  isMyPlace(playerId: PlayerId | undefined): boolean {
    return this.isMyTurn(playerId) && this.state.phase === MY_PLACE;
  }
}

type RoundReducerSignal = (round: Round, payload: unknown) => Round;

export default Round;