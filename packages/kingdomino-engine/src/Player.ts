import type { PlayerId, Direction, CardId } from "./types.ts";
import { Board } from "./Board.ts";

export class Player {
  private _board: Board = new Board();
  readonly id: PlayerId;

  constructor(id: PlayerId) {
    this.id = id;
  }

  get board(): Board {
    return this._board;
  }

  score(): number {
    return this._board.score();
  }

  applyPlacement(cardId: CardId, x: number, y: number, direction: Direction): void {
    this._board.place(cardId, x, y, direction);
  }
}
