import type { CardId, Direction, PlayerId } from "kingdomino-engine";
import type { BoardGrid } from "kingdomino-engine";

export type PlacementResult =
  | { x: number; y: number; direction: Direction }
  | { discard: true };

export interface PlayerActor {
  readonly playerId: PlayerId;
  /**
   * Ask the actor to choose a card from the available (unpicked) cards for
   * this round.  The actor may use the board snapshot to inform its choice.
   */
  awaitPick(availableCards: CardId[], boardSnapshot: BoardGrid): Promise<CardId>;
  /**
   * Ask the actor to place (or discard) the card they just picked.
   * Returns coordinates + direction, or { discard: true }.
   */
  awaitPlacement(cardId: CardId, boardSnapshot: BoardGrid): Promise<PlacementResult>;
  /** Release any held resources (e.g. cancel in-flight waits). */
  destroy(): void;
}
