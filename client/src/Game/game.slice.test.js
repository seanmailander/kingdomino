import gameReducer, { getMyPlayerId } from "./game.slice";

import { payload as actionsToFirstShuffle } from "./state.after-shuffle.json";

const actions = JSON.parse(actionsToFirstShuffle);

const applyAllActions = (reducer, actions) =>
  actions.reduce((state, action) => reducer(state, action), undefined);

describe("Game selectors", () => {
  it("Finds my playerId", () => {
    // Arrange
    const state = {
      game: applyAllActions(gameReducer, actions),
    };

    // Act
    const myPlayerId = getMyPlayerId(state);

    // Assert
    expect(myPlayerId).toBe("481b059d-120b-4489-841b-d5c8e64321b3");
  });
});
