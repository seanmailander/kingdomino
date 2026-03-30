import { describe, expect, it } from "vitest";
import { MultiplayerConnection, RemotePlayerActor } from "kingdomino-protocol";

import type { RosterConfig } from "../../Lobby/lobby.types";
import { LocalPlayerActor } from "./local.player.actor";
import { CouchPlayerActor } from "./couch.player.actor";
import { AIPlayerActor } from "./ai.player.actor";
import { DefaultRosterFactory } from "./default.roster.factory";

describe("DefaultRosterFactory", () => {
  it("returns local and AI actors for [local, ai] config", async () => {
    const factory = new DefaultRosterFactory();
    const config: RosterConfig = [{ type: "local" }, { type: "ai" }];

    const result = await factory.build(config);

    expect(result.players).toHaveLength(2);
    expect(result.players[0].actor).toBeInstanceOf(LocalPlayerActor);
    expect(result.players[1].actor).toBeInstanceOf(AIPlayerActor);
  });

  it("assigns stable player IDs p1, p2, p3", async () => {
    const factory = new DefaultRosterFactory();
    const config: RosterConfig = [{ type: "local" }, { type: "couch" }, { type: "ai" }];

    const result = await factory.build(config);

    expect(result.players.map((p) => p.id)).toEqual(["p1", "p2", "p3"]);
  });

  it("returns localPlayerId as first local player", async () => {
    const factory = new DefaultRosterFactory();
    const config: RosterConfig = [{ type: "local" }, { type: "ai" }];

    const result = await factory.build(config);

    expect(result.localPlayerId).toBe("p1");
  });

  it("returns localPlayerId as first couch player when no local", async () => {
    const factory = new DefaultRosterFactory();
    const config: RosterConfig = [{ type: "ai" }, { type: "couch" }];

    const result = await factory.build(config);

    expect(result.localPlayerId).toBe("p2");
  });

  it("returns localPlayerId null for all-AI config", async () => {
    const factory = new DefaultRosterFactory();
    const config: RosterConfig = [{ type: "ai" }, { type: "ai" }];

    const result = await factory.build(config);

    expect(result.localPlayerId).toBeNull();
  });

  it("returns CouchPlayerActor for couch slots", async () => {
    const factory = new DefaultRosterFactory();
    const config: RosterConfig = [{ type: "local" }, { type: "couch" }];

    const result = await factory.build(config);

    expect(result.players[1].actor).toBeInstanceOf(CouchPlayerActor);
  });

  it("provides a seed provider", async () => {
    const factory = new DefaultRosterFactory();
    const config: RosterConfig = [{ type: "local" }, { type: "ai" }];

    const result = await factory.build(config);

    expect(result.seedProvider).toBeDefined();
  });

  it("throws for remote slots that have no established connection", async () => {
    const factory = new DefaultRosterFactory();
    const config: RosterConfig = [{ type: "local" }, { type: "remote", peerId: "peer-123" }];

    await expect(factory.build(config)).rejects.toThrow("must have an established connection");
  });

  it("returns RemotePlayerActor for remote slots with a connection", async () => {
    const factory = new DefaultRosterFactory();
    const conn = new MultiplayerConnection({ me: "local-id", them: "peer-123" });
    const config: RosterConfig = [{ type: "local" }, { type: "remote", peerId: "peer-123", connection: conn }];

    const result = await factory.build(config);

    expect(result.players[1].actor).toBeInstanceOf(RemotePlayerActor);
  });

  it("uses commitment seed provider when remote slots are present", async () => {
    const factory = new DefaultRosterFactory();
    const conn = new MultiplayerConnection({ me: "local-id", them: "peer-123" });
    const config: RosterConfig = [{ type: "local" }, { type: "remote", peerId: "peer-123", connection: conn }];

    const result = await factory.build(config);

    expect(result.seedProvider).toBeDefined();
    // CommitmentSeedProvider has a nextSeed() method that returns a Promise
    expect(typeof result.seedProvider.nextSeed).toBe("function");
  });
});
