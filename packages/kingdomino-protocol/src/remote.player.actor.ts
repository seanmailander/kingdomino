import type { CardId, PlayerId } from "kingdomino-engine";
import type { BoardGrid } from "kingdomino-engine";
import { PLACE } from "./game.messages";
import type { PlayerActor, PlacementResult } from "./player.actor";
import type { ConnectionManager } from "./ConnectionManager";

export class RemotePlayerActor implements PlayerActor {
  constructor(
    readonly playerId: PlayerId,
    private readonly connection: ConnectionManager,
  ) {}

  async awaitPick(_availableCards: CardId[], _boardSnapshot: BoardGrid): Promise<CardId> {
    const msg = await this.connection.waitForPick();
    return msg.cardId;
  }

  async awaitPlacement(_cardId: CardId, _boardSnapshot: BoardGrid): Promise<PlacementResult> {
    const msg = await this.connection.waitForPlaceOrDiscard();
    if (msg.type === PLACE) {
      return { x: msg.x, y: msg.y, direction: msg.direction };
    }
    return { discard: true };
  }

  /** The connection lifecycle is owned externally; nothing to release here. */
  destroy(): void {}
}
