import { describe, it, expect } from "vitest";
import { Player } from "./Player";

describe("Player", () => {
  it("has an id", () => {
    const p = new Player("alice");
    expect(p.id).toBe("alice");
  });

  it("does not have an isLocal property", () => {
    const p = new Player("alice");
    // @ts-expect-error isLocal should not exist on Player
    expect(p.isLocal).toBeUndefined();
  });

  it("starts with a zero score", () => {
    const p = new Player("alice");
    expect(p.score()).toBe(0);
  });
});
