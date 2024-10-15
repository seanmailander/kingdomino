import gameReducer from "./game.slice";
import roundReducer, { getIsMyTurn } from "./round.slice";

import { payload as actionsToFirstShuffle } from "./state.after-shuffle.json";

const actions = JSON.parse(actionsToFirstShuffle);

const applyAllActions = (reducer, actions) =>
  actions.reduce((state, action) => reducer(state, action), undefined);

describe("Round selectors", () => {
  it("Finds my turn", () => {
    // Arrange
    const state = {
      game: applyAllActions(gameReducer, actions),
      round: applyAllActions(roundReducer, actions),
    };

    // Act
    const isMyTurn = getIsMyTurn(state);

    // Assert
    expect(isMyTurn).toBe(true);
  });
});
