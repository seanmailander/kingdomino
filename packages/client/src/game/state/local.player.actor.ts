import type { CardId } from "kingdomino-engine";
import type { PlayerActor, PlacementResult } from "kingdomino-protocol";
import type { PlayerId } from "kingdomino-engine";
import type { BoardGrid } from "kingdomino-engine";

export class LocalPlayerActor implements PlayerActor {
  readonly playerId: PlayerId;

  // TODO(UIIntentBus): replace resolver arrays with UIIntentBus event emitter (Seam 7)
  private pickResolvers: Array<(cardId: CardId) => void> = [];
  private placementResolvers: Array<(result: PlacementResult) => void> = [];

  constructor(playerId: PlayerId) {
    this.playerId = playerId;
  }

  awaitPick(_availableCards: CardId[], _boardSnapshot: BoardGrid): Promise<CardId> {
    return new Promise((resolve) => {
      this.pickResolvers.push(resolve);
    });
  }

  awaitPlacement(_cardId: CardId, _boardSnapshot: BoardGrid): Promise<PlacementResult> {
    return new Promise((resolve) => {
      this.placementResolvers.push(resolve);
    });
  }

  /** Called by the UI when the human picks a card. */
  resolvePick(cardId: CardId): void {
    const resolvers = this.pickResolvers;
    this.pickResolvers = [];
    for (const resolve of resolvers) resolve(cardId);
  }

  /** Called by the UI when the human places or discards. */
  resolvePlacement(result: PlacementResult): void {
    const resolvers = this.placementResolvers;
    this.placementResolvers = [];
    for (const resolve of resolvers) resolve(result);
  }

  destroy(): void {
    // No external resources to release. Pending resolvers will simply never fire.
  }
}
