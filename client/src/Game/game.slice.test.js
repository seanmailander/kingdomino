import gameReducer, {
  getMyPlayerId,
  getIsMyTurn,
  getOrder,
  orderChosen,
} from "./game.slice";

import { payload as actionsToFirstShuffle } from "./state.after-shuffle.json";

const actions = JSON.parse(actionsToFirstShuffle);
console.debug(actions);

const applyAllActions = (reducer, actions) =>
  actions.reduce((state, action) => reducer(state, action), undefined);

describe("Player selectors", () => {
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
  it("Finds my turn", () => {
    // Arrange
    const state = {
      game: applyAllActions(gameReducer, actions),
    };

    // Act
    const isMyTurn = getIsMyTurn(state);

    // Assert
    expect(isMyTurn).toBe(true);
  });
});
