import type { CardId, Direction } from "./types";
import type { Player } from "./Player";
import { Deal } from "./Deal";

export const ROUND_PHASE_PICKING  = "picking"  as const;
export const ROUND_PHASE_PLACING  = "placing"  as const;
export const ROUND_PHASE_COMPLETE = "complete" as const;
export type RoundPhase = typeof ROUND_PHASE_PICKING | typeof ROUND_PHASE_PLACING | typeof ROUND_PHASE_COMPLETE;

/**
 * One round: sequential pick-then-place per player.
 * Phase machine: picking → placing → picking → … → complete.
 * The _playerQueue drives order; after placement, the actor is dequeued.
 * Invalid transitions throw immediately rather than producing silent bad state.
 */
export class Round {
  private _phase: RoundPhase = ROUND_PHASE_PICKING;
  private readonly _playerQueue: Player[];
  private readonly _deal: Deal;

  constructor(deal: Deal, pickOrder: ReadonlyArray<Player>) {
    this._deal = deal;
    this._playerQueue = [...pickOrder];
  }

  get phase(): RoundPhase {
    return this._phase;
  }
  get deal(): Deal {
    return this._deal;
  }

  get currentActor(): Player | null {
    return this._playerQueue[0] ?? null;
  }

  recordPick(player: Player, cardId: CardId): void {
    if (this._phase !== ROUND_PHASE_PICKING) {
      throw new Error(`Round.recordPick() called in "${this._phase}" phase`);
    }
    if (player.id !== this.currentActor?.id) {
      throw new Error(`Not ${player.id}'s turn to pick (expected ${this.currentActor?.id})`);
    }
    this._deal.pickByCardId(player, cardId);
    this._phase = ROUND_PHASE_PLACING;
  }

  recordPlacement(player: Player, x: number, y: number, direction: Direction): void {
    if (this._phase !== ROUND_PHASE_PLACING) {
      throw new Error(`Round.recordPlacement() called in "${this._phase}" phase`);
    }
    if (player.id !== this.currentActor?.id) {
      throw new Error(`Not ${player.id}'s turn to place`);
    }
    const cardId = this._deal.pickedCardFor(player);
    if (cardId === null) throw new Error(`${player.id} has no picked card to place`);
    player.applyPlacement(cardId, x, y, direction);
    this._playerQueue.shift();
    this._phase = this._playerQueue.length === 0 ? ROUND_PHASE_COMPLETE : ROUND_PHASE_PICKING;
  }

  recordDiscard(player: Player): void {
    if (this._phase !== ROUND_PHASE_PLACING) {
      throw new Error(`Round.recordDiscard() called in "${this._phase}" phase`);
    }
    if (player.id !== this.currentActor?.id) {
      throw new Error(`Not ${player.id}'s turn to discard`);
    }
    this._playerQueue.shift();
    this._phase = this._playerQueue.length === 0 ? ROUND_PHASE_COMPLETE : ROUND_PHASE_PICKING;
  }
}
