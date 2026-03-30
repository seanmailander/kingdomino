import { RandomSeedProvider } from "kingdomino-commitment";
import type { GameVariant, PlayerId } from "kingdomino-engine";
import type { RosterConfig, PlayerSlotConfig } from "../../Lobby/lobby.types";
import type { RosterFactory, RosterResult } from "./RosterFactory";
import { LocalPlayerActor } from "./local.player.actor";
import { CouchPlayerActor } from "./couch.player.actor";
import { AIPlayerActor } from "./ai.player.actor";

type DefaultRosterFactoryOptions = {
  variant?: GameVariant;
};

export class DefaultRosterFactory implements RosterFactory {
  private readonly variant: GameVariant;

  constructor({ variant = "standard" }: DefaultRosterFactoryOptions = {}) {
    this.variant = variant;
  }

  async build(config: RosterConfig): Promise<RosterResult> {
    const hasRemote = config.some((slot) => slot.type === "remote");
    if (hasRemote) {
      // TODO(remote-factory): inject PeerSession + CommitmentSeedProvider for remote slots
      throw new Error("DefaultRosterFactory: remote slots not yet supported");
    }

    const seedProvider = new RandomSeedProvider();

    // Assign stable player IDs: p1, p2, p3, p4
    const playerIds: PlayerId[] = config.map((_, i) => `p${i + 1}` as PlayerId);

    // First non-AI player ID (used as AIPlayerActor's humanPlayerId)
    const firstHumanIndex = config.findIndex((slot) => slot.type !== "ai");
    const firstHumanId = firstHumanIndex >= 0 ? playerIds[firstHumanIndex] : playerIds[0];

    const players = config.map((slot: PlayerSlotConfig, i: number) => {
      const id = playerIds[i];
      const label = `Player ${i + 1}`;

      switch (slot.type) {
        case "local":
          return { id, actor: new LocalPlayerActor(id) };
        case "couch":
          return { id, actor: new CouchPlayerActor(id, label) };
        case "ai":
          return { id, actor: new AIPlayerActor(id, firstHumanId, this.variant) };
        case "remote":
          // Unreachable: guarded by hasRemote check above
          throw new Error(`DefaultRosterFactory: unexpected remote slot at index ${i}`);
      }
    });

    // localPlayerId: first local or couch player (the "me" perspective for isMyTurn)
    const localIndex = config.findIndex((slot) => slot.type === "local" || slot.type === "couch");
    const localPlayerId = localIndex >= 0 ? playerIds[localIndex] : null;

    return { players, seedProvider, localPlayerId };
  }
}
