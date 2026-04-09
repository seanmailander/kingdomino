import type { CardId, Direction } from "kingdomino-engine";
import type { PlayerActor, PlacementResult } from "kingdomino-protocol";
import type { PlayerId, BoardGrid, GameVariant } from "kingdomino-engine";
import { findPlacementWithin5x5, findPlacementWithin7x7, STANDARD, MIGHTY_DUEL } from "kingdomino-engine";

/**
 * Stateless AI actor that picks a random placeable card from the available
 * cards and finds a valid in-bounds placement. Uses the availableCards and
 * boardSnapshot provided by the GameDriver rather than maintaining a shadow
 * session.
 */
export class AIPlayerActor implements PlayerActor {
  readonly playerId: PlayerId;
  private readonly variant: GameVariant;
  private pendingPlacement: PlacementResult | null = null;

  constructor(playerId: PlayerId, _humanPlayerId: PlayerId, variant: GameVariant = STANDARD) {
    this.playerId = playerId;
    this.variant = variant;
  }

  awaitPick(availableCards: CardId[], boardSnapshot: BoardGrid): Promise<CardId> {
    const findPlacement =
      this.variant === MIGHTY_DUEL ? findPlacementWithin7x7 : findPlacementWithin5x5;

    // Shuffle for randomness
    const shuffled = [...availableCards].sort(() => Math.random() - 0.5);

    for (const cardId of shuffled) {
      const placement = findPlacement(boardSnapshot, cardId);
      if (placement !== null) {
        this.pendingPlacement = {
          x: placement.x,
          y: placement.y,
          direction: placement.direction,
        };
        return Promise.resolve(cardId);
      }
    }

    // No valid in-bounds placement for any card — pick first and discard
    this.pendingPlacement = { discard: true };
    return Promise.resolve(availableCards[0]);
  }

  awaitPlacement(_cardId: CardId, _boardSnapshot: BoardGrid): Promise<PlacementResult> {
    const result = this.pendingPlacement ?? { discard: true };
    this.pendingPlacement = null;
    return Promise.resolve(result);
  }

  destroy(): void { /* stateless — nothing to clean up */ }
}
