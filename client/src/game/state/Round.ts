import type { CardId, Direction } from "./types";
import type { Player } from "./Player";

type PickSlot = { cardId: CardId; pickedBy: Player | null };

export type RoundPhase = "picking" | "placing" | "complete";

/**
 * The four cards offered during a round.
 * Slots are sorted by card id so low-id → high priority in next-round pick order.
 */
export class Deal {
  private readonly _slots: PickSlot[];

  constructor(cardIds: [CardId, CardId, CardId, CardId]) {
    this._slots = [...cardIds]
      .sort((a, b) => a - b)
      .map(cardId => ({ cardId, pickedBy: null }));
  }

  pickByCardId(player: Player, cardId: CardId): void {
    const slot = this._slots.find(s => s.cardId === cardId);
    if (!slot) throw new Error(`Card ${cardId} not in current deal`);
    if (slot.pickedBy !== null) throw new Error(`Card ${cardId} already picked`);
    slot.pickedBy = player;
  }

  pickedCardFor(player: Player): CardId | null {
    return this._slots.find(s => s.pickedBy?.id === player.id)?.cardId ?? null;
  }

  /** Players ordered by their picked card id (low → high = first pick order next round) */
  nextRoundPickOrder(): Player[] {
    return this._slots
      .filter(s => s.pickedBy !== null)
      .map(s => s.pickedBy!);
  }

  snapshot(): ReadonlyArray<Readonly<PickSlot>> {
    return this._slots.map(s => ({ ...s }));
  }
}

/**
 * One round: sequential pick-then-place per player.
 * Phase machine: picking → placing → picking → … → complete.
 * The _playerQueue drives order; after placement, the actor is dequeued.
 * Invalid transitions throw immediately rather than producing silent bad state.
 */
export class Round {
  private _phase: RoundPhase = "picking";
  private readonly _playerQueue: Player[];
  private readonly _deal: Deal;

  constructor(deal: Deal, pickOrder: ReadonlyArray<Player>) {
    this._deal = deal;
    this._playerQueue = [...pickOrder];
  }

  get phase(): RoundPhase { return this._phase; }
  get deal(): Deal        { return this._deal; }

  /** The player whose action is expected: pick if "picking", place if "placing". */
  get currentActor(): Player | null {
    return this._playerQueue[0] ?? null;
  }

  recordPick(player: Player, cardId: CardId): void {
    if (this._phase !== "picking") {
      throw new Error(`Round.recordPick() called in "${this._phase}" phase`);
    }
    if (player.id !== this.currentActor?.id) {
      throw new Error(`Not ${player.id}'s turn to pick (expected ${this.currentActor?.id})`);
    }
    this._deal.pickByCardId(player, cardId);
    this._phase = "placing";
  }

  recordPlacement(player: Player, x: number, y: number, direction: Direction): void {
    if (this._phase !== "placing") {
      throw new Error(`Round.recordPlacement() called in "${this._phase}" phase`);
    }
    if (player.id !== this.currentActor?.id) {
      throw new Error(`Not ${player.id}'s turn to place`);
    }
    const cardId = this._deal.pickedCardFor(player);
    if (cardId === null) throw new Error(`${player.id} has no picked card to place`);
    player.applyPlacement(cardId, x, y, direction);
    this._playerQueue.shift();
    this._phase = this._playerQueue.length === 0 ? "complete" : "picking";
  }
}
