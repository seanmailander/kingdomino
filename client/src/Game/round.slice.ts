import { createAction, createSlice } from "@reduxjs/toolkit";
import { createSelector } from "reselect";

import { getCard } from "./gamelogic/cards";
import {
  cardPicked,
  cardPlaced,
  deckShuffled,
  orderChosen,
} from "./game.actions";
import { getMyPlayerId } from "./game.slice";
import { RootState } from "../App/reducer";
import { Card } from "./types";

// Round phases
export const roundStart = createAction("round-phase/start");
export const whoseTurn = createAction("round-phase/whoseTurn");
export const myPick = createAction("round-phase/myPick");
export const myPlace = createAction("round-phase/myPlace");
export const theirPick = createAction("round-phase/theirPick");
export const theirPlace = createAction("round-phase/theirPlace");
export const roundEnd = createAction("round-phase/end");

const phaseTransitions = [whoseTurn, myPick, myPlace, theirPick, theirPlace];

type RoundState = {
  phase: string;
  deal: Array<Card | undefined>;
  pickOrderThisRound: Array<string | undefined>;
  pickOrderNextRound: Array<string | undefined>;
  cardToPlace: Card | undefined;
};

const initialState: RoundState = {
  phase: `${roundStart}`,
  deal: [],
  pickOrderThisRound: [],
  pickOrderNextRound: [],
  cardToPlace: undefined,
};

export const roundSlice = createSlice({
  name: "round",
  initialState,
  reducers: {},
  extraReducers: (builder) => {
    phaseTransitions.map((event) =>
      builder.addCase(event, (state, action) => {
        state.phase = action.type;
      }),
    );

    builder
      .addCase(roundStart, (state, action) => {
        state.phase = action.type;
        state = {
          phase: action.type,
          deal: [],
          pickOrderThisRound: [undefined, undefined, undefined, undefined],
          pickOrderNextRound: [undefined, undefined, undefined, undefined],
          cardToPlace: undefined,
        };
      })
      .addCase(orderChosen, (state, action) => {
        state.phase = action.type;
        const { payload: order } = action;
        state.pickOrderThisRound = order;
      })
      .addCase(deckShuffled, (state, action) => {
        state.phase = action.type;
        state.deal = action.payload;
        state.cardToPlace = undefined;
      })
      .addCase(cardPicked, (state, action) => {
        state.phase = action.type;
        const card = action.payload;
        state.cardToPlace = card;
      })
      .addCase(cardPlaced, (state, action) => {
        state.phase = action.type;
        state.cardToPlace = undefined;
        const {
          payload: { card },
        } = action;

        const placeInDeal = state.deal.findIndex((c) => c === card);
        // Remove this card from cards that can be played this round
        state.deal[placeInDeal] = undefined;
        // Mark this player as finished
        const playerId = state.pickOrderThisRound.shift();
        // Mark this player in order for next round
        state.pickOrderNextRound[placeInDeal] = playerId;
      })
      .addCase(roundEnd, (state, action) => {
        state.phase = action.type;
        // Strip empty slots, and set that as the order for next round
        state.pickOrderThisRound = state.pickOrderNextRound.filter((p) => !!p);
        state.pickOrderNextRound = [undefined, undefined, undefined, undefined];
      });
  },
});

export const getPickOrder = (state: RootState) =>
  state.round.pickOrderThisRound;

const getPhase = (state: RootState) => state.round.phase;
export const getIsMyTurn = createSelector(
  [getPickOrder, getMyPlayerId],
  (pickOrder, myPlayerId) => pickOrder[0] === myPlayerId,
);

export const getIsMyPlace = createSelector(
  [getIsMyTurn, getPhase],
  (isMyTurn, phase) => isMyTurn && phase === `${myPlace}`,
);

export const getCardToPlace = (state: RootState) => state.round.cardToPlace;

export const getDeal = (state: RootState) => state.round.deal.map(getCard);

export default roundSlice.reducer;
