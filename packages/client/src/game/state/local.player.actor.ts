import type { CardId } from "kingdomino-engine";
import type { PlayerActor, PlacementResult } from "kingdomino-protocol";
import type { PlayerId } from "kingdomino-engine";
import type { BoardGrid } from "kingdomino-engine";

type PickResolver    = { resolve: (cardId: CardId) => void;        reject: (err: Error) => void };
type PlaceResolver   = { resolve: (result: PlacementResult) => void; reject: (err: Error) => void };

export class LocalPlayerActor implements PlayerActor {
  readonly playerId: PlayerId;

  // TODO(UIIntentBus): replace resolver arrays with UIIntentBus event emitter (Seam 7)
  private pickResolvers: PickResolver[]  = [];
  private placementResolvers: PlaceResolver[] = [];

  constructor(playerId: PlayerId) {
    this.playerId = playerId;
  }

  awaitPick(_availableCards: CardId[], _boardSnapshot: BoardGrid): Promise<CardId> {
    return new Promise((resolve, reject) => {
      this.pickResolvers.push({ resolve, reject });
    });
  }

  awaitPlacement(_cardId: CardId, _boardSnapshot: BoardGrid): Promise<PlacementResult> {
    return new Promise((resolve, reject) => {
      this.placementResolvers.push({ resolve, reject });
    });
  }

  /** Called by the UI (or flow adapter) when the human picks a card. */
  resolvePick(cardId: CardId): void {
    const resolvers = this.pickResolvers;
    this.pickResolvers = [];
    for (const { resolve } of resolvers) resolve(cardId);
  }

  /** Called by the UI (or flow adapter) when the human places or discards. */
  resolvePlacement(result: PlacementResult): void {
    const resolvers = this.placementResolvers;
    this.placementResolvers = [];
    for (const { resolve } of resolvers) resolve(result);
  }

  destroy(): void {
    const err = new Error("LocalPlayerActor destroyed");
    for (const { reject } of this.pickResolvers) reject(err);
    for (const { reject } of this.placementResolvers) reject(err);
    this.pickResolvers = [];
    this.placementResolvers = [];
  }
}
