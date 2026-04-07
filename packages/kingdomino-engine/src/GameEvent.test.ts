import { describe, it, expectTypeOf } from "vitest";
import type { GameEvent, PickMadeEvent, PlaceMadeEvent } from "./GameEvent";

describe("GameEvent", () => {
  it("GameEvent is a discriminated union with type field", () => {
    expectTypeOf<GameEvent>().toHaveProperty("type");
  });

  it("PickMadeEvent has player and cardId", () => {
    expectTypeOf<PickMadeEvent>().toHaveProperty("player");
    expectTypeOf<PickMadeEvent>().toHaveProperty("cardId");
  });

  it("PlaceMadeEvent has coordinates", () => {
    expectTypeOf<PlaceMadeEvent>().toHaveProperty("x");
    expectTypeOf<PlaceMadeEvent>().toHaveProperty("y");
    expectTypeOf<PlaceMadeEvent>().toHaveProperty("direction");
  });
});
