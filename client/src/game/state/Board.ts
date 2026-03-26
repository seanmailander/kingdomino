import { getEmptyBoard } from "../gamelogic/board";
import { castle, getCard, up, down, left, right } from "../gamelogic/cards";
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
    const grid = this.snapshot();
    const size = grid.length;
    const visited = Array.from({ length: size }, () => new Array<boolean>(size).fill(false));
    let total = 0;

    for (let y = 0; y < size; y++) {
      for (let x = 0; x < size; x++) {
        const cell = grid[y][x];
        // castle (tile===0) and empty cells don't score
        if (visited[y][x] || !cell?.tile) continue;

        const terrain = cell.tile;
        const queue: [number, number][] = [[x, y]];
        let regionSize = 0;
        let regionCrowns = 0;

        while (queue.length > 0) {
          const [cx, cy] = queue.pop()!;
          if (visited[cy][cx]) continue;
          visited[cy][cx] = true;
          regionSize++;
          regionCrowns += grid[cy][cx]?.value ?? 0;

          const neighbors: [number, number][] = [
            [cx + 1, cy],
            [cx - 1, cy],
            [cx, cy + 1],
            [cx, cy - 1],
          ];
          for (const [nx, ny] of neighbors) {
            if (
              nx >= 0 &&
              nx < size &&
              ny >= 0 &&
              ny < size &&
              !visited[ny][nx] &&
              grid[ny][nx]?.tile === terrain
            ) {
              queue.push([nx, ny]);
            }
          }
        }

        total += regionSize * regionCrowns;
      }
    }
    return total;
  }

  /** Size of the largest single contiguous terrain region (castle excluded). */
  largestPropertySize(): number {
    const grid = this.snapshot();
    const size = grid.length;
    const visited = Array.from({ length: size }, () => new Array<boolean>(size).fill(false));
    let maxSize = 0;

    for (let y = 0; y < size; y++) {
      for (let x = 0; x < size; x++) {
        const cell = grid[y][x];
        if (visited[y][x] || !cell?.tile) continue;

        const terrain = cell.tile;
        const queue: [number, number][] = [[x, y]];
        let regionSize = 0;

        while (queue.length > 0) {
          const [cx, cy] = queue.pop()!;
          if (visited[cy][cx]) continue;
          visited[cy][cx] = true;
          regionSize++;

          const neighbors: [number, number][] = [
            [cx + 1, cy],
            [cx - 1, cy],
            [cx, cy + 1],
            [cx, cy - 1],
          ];
          for (const [nx, ny] of neighbors) {
            if (
              nx >= 0 &&
              nx < size &&
              ny >= 0 &&
              ny < size &&
              !visited[ny][nx] &&
              grid[ny][nx]?.tile === terrain
            ) {
              queue.push([nx, ny]);
            }
          }
        }

        if (regionSize > maxSize) maxSize = regionSize;
      }
    }
    return maxSize;
  }

  /** Sum of all crown values across all terrain tiles (castle excluded). */
  totalCrowns(): number {
    const grid = this.snapshot();
    let total = 0;
    for (const row of grid) {
      for (const cell of row) {
        if (cell?.tile) total += cell.value ?? 0;
      }
    }
    return total;
  }

  get placements(): ReadonlyArray<BoardPlacement> {
    return this._placements;
  }
}
