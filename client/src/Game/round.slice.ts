import { createAction, createSlice } from "@reduxjs/toolkit";
import { createSelector } from "reselect";

import { getCard } from "./gamelogic/cards";
import { cardPicked, cardPlaced, deckShuffled, orderChosen } from "./game.actions";
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
export const roundStart = createAction("round-phase/start");
export const whoseTurn = createAction("round-phase/whoseTurn");
export const myPick = createAction("round-phase/myPick");
export const myPlace = createAction("round-phase/myPlace");
export const theirPick = createAction("round-phase/theirPick");
export const theirPlace = createAction("round-phase/theirPlace");
export const roundEnd = createAction("round-phase/end");

const initialState: RoundState = {
  phase: `${roundStart}`,
  deal: [],
  pickOrderThisRound: [],
  pickOrderNextRound: [],
  cardToPlace: undefined,
};

type RoundSelectorState = {
  game: { players: Array<{ playerId: PlayerId; isMe: boolean }> };
  round: RoundState;
};

export const roundSlice = createSlice({
  name: "round",
  initialState,
  reducers: {},
  extraReducers: (builder) => {
    builder.addCase(roundStart, (state) => {
      state.phase = `${roundStart}`;
      state.deal = [];
      state.pickOrderThisRound = [undefined, undefined, undefined, undefined];
      state.pickOrderNextRound = [undefined, undefined, undefined, undefined];
      state.cardToPlace = undefined;
    });
    builder.addCase(whoseTurn, (state) => {
      state.phase = `${whoseTurn}`;
    });
    builder.addCase(myPick, (state) => {
      state.phase = `${myPick}`;
    });
    builder.addCase(myPlace, (state) => {
      state.phase = `${myPlace}`;
    });
    builder.addCase(theirPick, (state) => {
      state.phase = `${theirPick}`;
    });
    builder.addCase(theirPlace, (state) => {
      state.phase = `${theirPlace}`;
    });
    builder.addCase(orderChosen, (state, action) => {
      const { payload: order } = action;
      state.pickOrderThisRound = order;
    });
    builder.addCase(deckShuffled, (state, action) => {
      state.deal = action.payload;
      state.cardToPlace = undefined;
    });
    builder.addCase(cardPicked, (state, action) => {
      const card = action.payload;
      state.cardToPlace = card;
    });
    builder.addCase(cardPlaced, (state, action) => {
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
    });
    builder.addCase(roundEnd, (state) => {
      state.phase = `${roundEnd}`;
      // Strip empty slots, and set that as the order for next round
      state.pickOrderThisRound = state.pickOrderNextRound.filter((p) => !!p);
      state.pickOrderNextRound = [undefined, undefined, undefined, undefined];
    });
  },
});

export const getPickOrder = (state: RoundSelectorState) => state.round.pickOrderThisRound;

const getPhase = (state: RoundSelectorState) => state.round.phase;
export const getIsMyTurn = createSelector(
  [getPickOrder, getMyPlayerId],
  (pickOrder, myPlayerId) => pickOrder[0] === myPlayerId,
);

export const getIsMyPlace = createSelector(
  [getIsMyTurn, getPhase],
  (isMyTurn, phase) => isMyTurn && phase === `${myPlace}`,
);

export const getCardToPlace = (state: RoundSelectorState) => state.round.cardToPlace;

export const getDeal = (state: RoundSelectorState) => state.round.deal.map(getCard);

export default roundSlice.reducer;
