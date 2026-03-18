import type { CardId } from "./types";
import type { Player } from "./Player";

type PickSlot = { cardId: CardId; pickedBy: Player | null };

/**
 * The four cards offered during a round.
 * Slots are sorted by card id so low-id -> high priority in next-round pick order.
 */
export class Deal {
  private readonly _slots: PickSlot[];

  constructor(cardIds: [CardId, CardId, CardId, CardId]) {
    this._slots = [...cardIds].sort((a, b) => a - b).map((cardId) => ({ cardId, pickedBy: null }));
  }

  pickByCardId(player: Player, cardId: CardId): void {
    const slot = this._slots.find((s) => s.cardId === cardId);
    if (!slot) throw new Error(`Card ${cardId} not in current deal`);
    if (slot.pickedBy !== null) throw new Error(`Card ${cardId} already picked`);
    slot.pickedBy = player;
  }

  pickedCardFor(player: Player): CardId | null {
    return this._slots.find((s) => s.pickedBy?.id === player.id)?.cardId ?? null;
  }

  /** Players ordered by their picked card id (low -> high = first pick order next round) */
  nextRoundPickOrder(): Player[] {
    return this._slots.filter((s) => s.pickedBy !== null).map((s) => s.pickedBy!);
  }

  snapshot(): ReadonlyArray<Readonly<PickSlot>> {
    return this._slots.map((s) => ({ ...s }));
  }
}
