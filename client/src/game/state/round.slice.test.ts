import gameReducer from "./game.slice";
import Round from "./Round";

import { payload as actionsToFirstShuffle } from "./state.after-shuffle.json";

const actions = JSON.parse(actionsToFirstShuffle);

const applyAllActions = (reducer, actions) =>
  actions.reduce((state, action) => reducer(state, action), undefined);

describe("Round selectors", () => {
  it("Finds my turn", () => {
    // Arrange
    const state = {
      app: {
        game: applyAllActions(gameReducer, actions),
      },
    };

    // Act
    const isMyTurn = Round.isMyTurn(state);

    // Assert
    expect(isMyTurn).toBe(true);
  });
});
