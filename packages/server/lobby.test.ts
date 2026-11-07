import { describe, it, expect } from "vitest";
import { letMeIn, type Lobby } from "./lobby.js";

describe("letMeIn matchmaking", () => {
  it("pairs two live players: second waits, first reaches out", () => {
    const lobby: Lobby = {};
    expect(letMeIn(lobby, "A", 0)).toEqual({ checkBackInMs: 1000 });
    expect(letMeIn(lobby, "B", 500)).toEqual({ waitForConnection: true });
    expect(letMeIn(lobby, "A", 1000)).toEqual({ otherPlayerId: "B" });
    expect(lobby).toEqual({});
  });

  it("does not pair with a player who stopped polling (ghost)", () => {
    const lobby: Lobby = {};
    letMeIn(lobby, "ghost", 0);
    expect(letMeIn(lobby, "B", 5000)).toEqual({ checkBackInMs: 1000 });
    expect(lobby.ghost).toBeUndefined();
  });

  it("does not pair a third player with an already-paired player", () => {
    const lobby: Lobby = {};
    letMeIn(lobby, "A", 0);
    letMeIn(lobby, "B", 100);
    expect(letMeIn(lobby, "C", 200)).toEqual({ checkBackInMs: 1000 });
    expect(letMeIn(lobby, "A", 1000)).toEqual({ otherPlayerId: "B" });
  });
});
