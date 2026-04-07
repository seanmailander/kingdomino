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
    // Pre-register both rejection handlers before any await to prevent unhandled rejections.
    // NOTE: The losing resolver (whichever of place/discard does not arrive) stays registered
    // in ConnectionManager's queue. This matches the existing pattern in
    // ConnectionManager.waitForPickAndPlacement(). If this becomes a problem in multi-round
    // play (stale waiter consuming a future message), ConnectionManager needs a
    // waitForPlaceOrDiscard() that handles cancellation internally.
    const placeOrNull = this.connection.waitForPlace().catch((): null => null);
    const discardOrNull = this.connection.waitForDiscard().catch((): null => null);

    const msg = await Promise.race([placeOrNull, discardOrNull]);
    if (!msg) throw new Error("RemotePlayerActor: connection closed while waiting for placement");

    if (msg.type === PLACE) {
      return { x: msg.x, y: msg.y, direction: msg.direction };
    }
    return { discard: true };
  }

  /** The connection lifecycle is owned externally; nothing to release here. */
  destroy(): void {}
}
