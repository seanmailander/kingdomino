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

// Round phases
export const roundStart = createAction("round-phase/start");
export const whoseTurn = createAction("round-phase/whoseTurn");
export const myPick = createAction("round-phase/myPick");
export const myPlace = createAction("round-phase/myPlace");
export const theirPick = createAction("round-phase/theirPick");
export const theirPlace = createAction("round-phase/theirPlace");
export const roundEnd = createAction("round-phase/end");

const phaseTransitions = [
  roundStart,
  whoseTurn,
  myPick,
  myPlace,
  theirPick,
  theirPlace,
  roundEnd,
].map((event) => ({
  [event]: (state, action) => {
    console.debug(action);
    state.phase = action.type;
  },
}));

export const roundSlice = createSlice({
  name: "round",
  initialState: {
    phase: `${roundStart}`,
    deal: [],
    pickOrderThisRound: [],
    pickOrderNextRound: [],
    cardToPlace: undefined,
  },
  extraReducers: {
    ...Object.assign({}, ...phaseTransitions),
    [roundStart]: (state, action) => {
      state = {
        deal: [],
        pickOrderThisRound: [undefined, undefined, undefined, undefined],
        pickOrderNextRound: [undefined, undefined, undefined, undefined],
        cardToPlace: undefined,
      };
    },
    [orderChosen]: (state, action) => {
      const { payload: order } = action;
      state.pickOrderThisRound = order;
    },
    [deckShuffled]: (state, action) => {
      state.deal = action.payload;
      state.cardToPlace = undefined;
    },
    [cardPicked]: (state, action) => {
      const card = action.payload;
      state.cardToPlace = card;
      console.debug(action);
    },
    [cardPlaced]: (state, action) => {
      console.debug(action);
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
    },
    [roundEnd]: (state, action) => {
      // Strip empty slots, and set that as the order for next round
      state.pickOrderThisRound = state.pickOrderNextRound.filter((p) => !!p);
      state.pickOrderNextRound = [undefined, undefined, undefined, undefined];
    },
  },
});

export const getPickOrder = (state) => state.round.pickOrderThisRound;

const getPhase = (state) => state.round.phase;
export const getIsMyTurn = createSelector(
  [getPickOrder, getMyPlayerId],
  (pickOrder, myPlayerId) => pickOrder[0] === myPlayerId
);

export const getIsMyPlace = createSelector(
  [getIsMyTurn, getPhase],
  (isMyTurn, phase) => isMyTurn && phase === `${myPlace}`
);

export const getCardToPlace = (state) => state.round.cardToPlace;

export const getDeal = (state) => state.round.deal.map(getCard);

export default roundSlice.reducer;
