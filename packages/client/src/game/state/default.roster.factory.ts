import { CommitmentSeedProvider, RandomSeedProvider } from "kingdomino-commitment";
import type { GameVariant, PlayerId } from "kingdomino-engine";
import { STANDARD } from "kingdomino-engine";
import type { RosterConfig, PlayerSlotConfig } from "../../Lobby/lobby.types";
import { SLOT_LOCAL, SLOT_COUCH, SLOT_AI, SLOT_REMOTE } from "../../Lobby/lobby.types";
import type { RosterFactory, RosterResult } from "./RosterFactory";
import { LocalPlayerActor } from "./local.player.actor";
import { CouchPlayerActor } from "./couch.player.actor";
import { AIPlayerActor } from "./ai.player.actor";
import { ConnectionManager, RemotePlayerActor } from "kingdomino-protocol";
import type { CommitmentTransport } from "kingdomino-commitment";

type DefaultRosterFactoryOptions = {
  variant?: GameVariant;
};

export class DefaultRosterFactory implements RosterFactory {
  private readonly variant: GameVariant;

  constructor({ variant = STANDARD }: DefaultRosterFactoryOptions = {}) {
    this.variant = variant;
  }

  async build(config: RosterConfig): Promise<RosterResult> {
    const remoteSlots = config.filter((slot) => slot.type === SLOT_REMOTE);
    if (remoteSlots.some((slot) => !slot.connection)) {
      throw new Error("DefaultRosterFactory: remote slots must have an established connection");
    }

    // Use commitment seed protocol when any remote peer is present
    const firstRemote = remoteSlots[0];
    const seedProvider = firstRemote
      ? new CommitmentSeedProvider(firstRemote.connection as unknown as CommitmentTransport)
      : new RandomSeedProvider();

    // Assign stable player IDs: p1, p2, p3, p4
    const playerIds: PlayerId[] = config.map((_, i) => `p${i + 1}` as PlayerId);

    // First non-AI player ID (used as AIPlayerActor's humanPlayerId)
    const firstHumanIndex = config.findIndex((slot) => slot.type !== SLOT_AI);
    const firstHumanId = firstHumanIndex >= 0 ? playerIds[firstHumanIndex] : playerIds[0];

    const players = config.map((slot: PlayerSlotConfig, i: number) => {
      const id = playerIds[i];
      const label = `Player ${i + 1}`;

      switch (slot.type) {
        case SLOT_LOCAL:
          return { id, actor: new LocalPlayerActor(id) };
        case SLOT_COUCH:
          return { id, actor: new CouchPlayerActor(id, label) };
        case SLOT_AI:
          return { id, actor: new AIPlayerActor(id, firstHumanId, this.variant) };
        case SLOT_REMOTE: {
          const conn = slot.connection!;
          const cm = new ConnectionManager(conn.send, conn.waitFor);
          return { id, actor: new RemotePlayerActor(id, cm) };
        }
      }
    });

    // localPlayerId: first local or couch player (the "me" perspective for isMyTurn)
    const localIndex = config.findIndex((slot) => slot.type === SLOT_LOCAL || slot.type === SLOT_COUCH);
    const localPlayerId = localIndex >= 0 ? playerIds[localIndex] : null;

    return { players, seedProvider, localPlayerId };
  }
}
