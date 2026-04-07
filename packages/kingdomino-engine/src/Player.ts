import type { PlayerId, Direction, CardId } from "./types";
import { Board } from "./Board";

export class Player {
  private _board: Board = new Board();

  constructor(readonly id: PlayerId) {}

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
