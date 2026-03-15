import { placedCardsToBoard } from "../gamelogic/board";
import type { Direction, CardId } from "./types";

/** Legacy cell format used by board.ts utilities and visual components */
export type BoardCell = { tile?: number; value?: number };
export type BoardGrid = ReadonlyArray<ReadonlyArray<BoardCell>>;

type LegacyPlacement = { card: CardId; x: number; y: number; direction: Direction };

/**
 * Player's kingdom. Accumulates placements; computes score via BFS.
 * place() returns a new Board value, enabling undo history without external helpers.
 * Delegates grid computation to the existing placedCardsToBoard() function so that
 * board.ts utilities (getEligiblePositions, enrichBoardWithCard) keep working unchanged.
 */
export class Board {
  private readonly _placements: ReadonlyArray<LegacyPlacement>;

  constructor(placements: LegacyPlacement[] = []) {
    this._placements = placements;
  }

  place(cardId: CardId, x: number, y: number, direction: Direction): Board {
    return new Board([...this._placements, { card: cardId, x, y, direction }]);
  }

  snapshot(): BoardGrid {
    return placedCardsToBoard(this._placements as LegacyPlacement[]);
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
            [cx + 1, cy], [cx - 1, cy], [cx, cy + 1], [cx, cy - 1],
          ];
          for (const [nx, ny] of neighbors) {
            if (nx >= 0 && nx < size && ny >= 0 && ny < size
              && !visited[ny][nx] && grid[ny][nx]?.tile === terrain) {
              queue.push([nx, ny]);
            }
          }
        }

        total += regionSize * regionCrowns;
      }
    }
    return total;
  }

  get placements(): ReadonlyArray<LegacyPlacement> {
    return this._placements;
  }
}
