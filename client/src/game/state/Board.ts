import {
  getEmptyBoard,
  scoreBoard,
  largestRegion,
  totalCrowns as computeTotalCrowns,
  isCastleCentered as computeIsCastleCentered,
} from "kingdomino-engine";
import { castle, getCard, up, down, left, right } from "kingdomino-engine";
import type { Direction, CardId } from "./types";

/** Legacy cell format used by board.ts utilities and visual components */
export type BoardCell = { tile?: number; value?: number };
export type BoardGrid = ReadonlyArray<ReadonlyArray<BoardCell>>;
type MutableBoard = BoardCell[][];

export type BoardPlacement = { card: CardId; x: number; y: number; direction: Direction };

const xDirection = {
  [up]: 0,
  [right]: 1,
  [down]: 0,
  [left]: -1,
} as const;

const yDirection = {
  [up]: -1,
  [right]: 0,
  [down]: 1,
  [left]: 0,
} as const;

const isWithinBounds = ({ x, y }: { x: number; y: number }): boolean =>
  x >= 0 && x <= 12 && y >= 0 && y <= 12;

/**
 * Player's kingdom. Accumulates placements; computes score via BFS.
 * place() mutates the current Board instance.
 * Converts placements into a board snapshot used by game logic and visuals.
 */
export class Board {
  private _placements: BoardPlacement[];
  private _board: MutableBoard;

  constructor(placements: BoardPlacement[] = []) {
    this._placements = placements;
    this._board = getEmptyBoard();
  }

  place(cardId: CardId, x: number, y: number, direction: Direction): Board {
    this._placements.push({ card: cardId, x, y, direction });
    return this;
  }

  private placeCardOnBoard({ card, x, y, direction }: BoardPlacement): void {
    const xB = x + xDirection[direction];
    const yB = y + yDirection[direction];

    if (!isWithinBounds({ x: xB, y: yB })) {
      return;
    }

    const {
      tiles: [{ tile: tileA, value: valueA }, { tile: tileB, value: valueB }],
    } = getCard(card);

    this._board[y][x] = {
      tile: tileA,
      value: valueA,
    };

    this._board[yB][xB] = {
      tile: tileB,
      value: valueB,
    };
  }

  private rebuildBoardSnapshot(): BoardGrid {
    this._board = getEmptyBoard();
    this._board[6][6] = {
      tile: castle,
    };

    this._placements.forEach((placement) => this.placeCardOnBoard(placement));
    return this._board;
  }

  /**
   * @deprecated Test setup helper only. Runtime code should use snapshot().
   */
  placedCardsToBoard(): BoardGrid {
    return this.rebuildBoardSnapshot();
  }

  snapshot(): BoardGrid {
    return this.rebuildBoardSnapshot();
  }

  score(): number {
    return scoreBoard(this.snapshot());
  }

  /** Size of the largest single contiguous terrain region (castle excluded). */
  largestPropertySize(): number {
    return largestRegion(this.snapshot());
  }

  /** Sum of all crown values across all terrain tiles (castle excluded). */
  totalCrowns(): number {
    return computeTotalCrowns(this.snapshot());
  }

  /** Returns true if the castle (at grid position 6,6) is at the center of the
   * bounding box of all placed tiles. Centered means minX + maxX == 12 AND
   * minY + maxY == 12 (since the castle sits at col=6, row=6, i.e. 6×2=12). */
  isCastleCentered(): boolean {
    return computeIsCastleCentered(this.snapshot());
  }

  get placements(): ReadonlyArray<BoardPlacement> {
    return this._placements;
  }
}
