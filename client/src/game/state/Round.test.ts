import Round, { MY_PLACE, ROUND_END, ROUND_START } from "./Round";

describe("Round POJO", () => {
  it("starts a fresh round with pick slots", () => {
    const round = Round.fromState().start().stateSnapshot();

    expect(round.phase).toBe(ROUND_START);
    expect(round.deal).toEqual([]);
    expect(round.pickOrderThisRound).toEqual([undefined, undefined, undefined, undefined]);
    expect(round.pickOrderNextRound).toEqual([undefined, undefined, undefined, undefined]);
    expect(round.cardToPlace).toBeUndefined();
  });

  it("advances pick order and next-round order when a card is placed", () => {
    const round = Round.fromState()
      .start()
      .chooseOrder(["me", "them"])
      .shuffleDeck([3, 26, 34, 32])
      .pickCard(26)
      .placeCard({ card: 26 });

    const state = round.stateSnapshot();
    expect(state.deal).toEqual([3, undefined, 34, 32]);
    expect(state.pickOrderThisRound).toEqual(["them"]);
    expect(state.pickOrderNextRound).toEqual([undefined, "me", undefined, undefined]);
    expect(state.cardToPlace).toBeUndefined();
  });

  it("moves to place phase and reports whether it is my placement turn", () => {
    const round = Round.fromState().start().chooseOrder(["me", "them"]).setMyPlace();

    expect(round.phase()).toBe(MY_PLACE);
    expect(round.isMyTurn("me")).toBe(true);
    expect(round.isMyPlace("me")).toBe(true);
    expect(round.isMyPlace("them")).toBe(false);
  });

  it("promotes next-round order when the round ends", () => {
    const round = Round.fromState().start().chooseOrder(["me", "them"]);

    round
      .shuffleDeck([3, 26, 34, 32])
      .placeCard({ card: 26 })
      .placeCard({ card: 32 })
      .end();

    const state = round.stateSnapshot();
    expect(state.phase).toBe(ROUND_END);
    expect(state.pickOrderThisRound).toEqual(["me", "them"]);
    expect(state.pickOrderNextRound).toEqual([undefined, undefined, undefined, undefined]);
  });
});