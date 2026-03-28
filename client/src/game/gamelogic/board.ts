import type { BoardCell } from "../state/Board";
import { validTiles, getCard, up, down, left, right } from "./cards";
import type { Direction } from "../state/types";
import type { CardId } from "../state/types";

type Board = ReadonlyArray<ReadonlyArray<BoardCell>>;
type MutableBoard = BoardCell[][];
type Position = { x: number; y: number };
type Neighbor = Position & { direction: Direction };

const range = (len: number): number[] => [...Array(len).keys()];

// Max board size is 13 x 13
export const getEmptyBoard: () => MutableBoard = () =>
  range(13).map((_r) => range(13).map((_x) => ({ tile: undefined })));

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

const oppositeDirection: Record<Direction, Direction> = {
  [up]: down,
  [right]: left,
  [down]: up,
  [left]: right,
} as const;

export const getFlippedPosition = (
  x: number,
  y: number,
  direction: Direction,
  flipped: boolean,
): { flippedX: number; flippedY: number; flippedDirection: Direction } => {
  if (!flipped) {
    return { flippedX: x, flippedY: y, flippedDirection: direction };
  }

  const flippedX = x + xDirection[direction];
  const flippedY = y + yDirection[direction];
  const flippedDirection = oppositeDirection[direction];

  return {
    flippedX,
    flippedY,
    flippedDirection,
  };
};

const tileIsValid = (board: Board, x: number, y: number): boolean =>
  validTiles.some((d) => d === board[y][x]?.tile);
const isWithinBounds = ({ x, y }: Position): boolean => x >= 0 && x <= 12 && y >= 0 && y <= 12;
const getNeighbors = (x: number, y: number): Neighbor[] =>
  [
    { x: x + 1, y, direction: right },
    { x: x - 1, y, direction: left },
    { x, y: y + 1, direction: down },
    { x, y: y - 1, direction: up },
  ].filter(isWithinBounds);

export const getEligiblePositions = (board: Board, cardId?: CardId | null): Neighbor[] => {
  if (cardId == null) {
    return [];
  }
  const allPositions = board.reduce<Array<{ card: BoardCell; x: number; y: number }>>(
    (prev, curr, y) => {
      return [...prev, ...curr.map((card, x) => ({ card, x, y }))];
    },
    [],
  );

  const { type } = getCard(cardId);
  const onlyPlayedSpots = ({ card }: { card: BoardCell }) => card?.tile !== null;
  const onlyMatchingTiles = ({ card }: { card: BoardCell }) =>
    card.tile === 0 || (card.tile !== undefined && !!(card.tile & type));

  const playedSpots = allPositions.filter(onlyPlayedSpots).filter(onlyMatchingTiles);

  const validNeighbors = playedSpots.reduce<Neighbor[]>(
    (prev, { x, y }) => [
      ...prev,
      ...getNeighbors(x, y).filter(({ x, y }) => !tileIsValid(board, x, y)),
    ],
    [],
  );

  return validNeighbors;
};

export const getValidDirections = (
  board: Board,
  _card: CardId,
  tileX: number,
  tileY: number,
): Direction[] =>
  getNeighbors(tileX, tileY)
    .filter(({ x, y }) => !tileIsValid(board, x, y))
    .map(({ x: _x, y: _y, direction }) => direction);

const directionDelta: Record<Direction, { dx: number; dy: number }> = {
  [up]: { dx: 0, dy: -1 },
  [right]: { dx: 1, dy: 0 },
  [down]: { dx: 0, dy: 1 },
  [left]: { dx: -1, dy: 0 },
};

const directionPriority: Direction[] = [up, right, down, left];

export const staysWithinBounds = (
  board: Board,
  x: number,
  y: number,
  direction: Direction,
  maxSize: number,
): boolean => {
  const occupied: Array<{ x: number; y: number }> = board.reduce(
    (all, row, rowY) => [
      ...all,
      ...row
        .map((cell, rowX) => ({ cell, rowX }))
        .filter(({ cell }) => cell?.tile !== undefined && cell.tile !== null)
        .map(({ rowX }) => ({ x: rowX, y: rowY })),
    ],
    [] as Array<{ x: number; y: number }>,
  );

  const nextDelta = directionDelta[direction];
  occupied.push({ x, y });
  occupied.push({ x: x + nextDelta.dx, y: y + nextDelta.dy });

  const xs = occupied.map((p) => p.x);
  const ys = occupied.map((p) => p.y);
  const width = Math.max(...xs) - Math.min(...xs) + 1;
  const height = Math.max(...ys) - Math.min(...ys) + 1;

  return width <= maxSize && height <= maxSize;
};

export const staysWithin5x5 = (
  board: Board,
  x: number,
  y: number,
  direction: Direction,
): boolean => staysWithinBounds(board, x, y, direction, 5);

export const staysWithin7x7 = (
  board: Board,
  x: number,
  y: number,
  direction: Direction,
): boolean => staysWithinBounds(board, x, y, direction, 7);

export const findPlacementWithinBounds = (
  board: Board,
  cardId: CardId,
  maxSize: number,
): { x: number; y: number; direction: Direction } | null => {
  const candidateAnchors = getEligiblePositions(board, cardId).sort(
    (a, b) => a.y - b.y || a.x - b.x,
  );

  for (const { x, y } of candidateAnchors) {
    const directions = (getValidDirections(board, cardId, x, y) as Direction[]).sort(
      (a, b) => directionPriority.indexOf(a) - directionPriority.indexOf(b),
    );
    const validDirection = directions.find((direction) =>
      staysWithinBounds(board, x, y, direction, maxSize),
    );
    if (validDirection !== undefined) {
      return { x, y, direction: validDirection };
    }
  }

  return null;
};

export const findPlacementWithin5x5 = (
  board: Board,
  cardId: CardId,
): { x: number; y: number; direction: Direction } | null => findPlacementWithinBounds(board, cardId, 5);

export const findPlacementWithin7x7 = (
  board: Board,
  cardId: CardId,
): { x: number; y: number; direction: Direction } | null => findPlacementWithinBounds(board, cardId, 7);

// ── Pure scoring functions ────────────────────────────────────────────────────
// These are pure functions over a board grid snapshot.
// Board.ts methods delegate to these for testability and reuse.

/** BFS flood-fill: score = Σ(regionSize × regionCrowns). Castle (tile===0) and empty cells excluded. */
export const scoreBoard = (grid: Board): number => {
  const size = grid.length;
  const visited = Array.from({ length: size }, () => new Array<boolean>(size).fill(false));
  let total = 0;

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const cell = grid[y][x];
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

        for (const [nx, ny] of [[cx + 1, cy], [cx - 1, cy], [cx, cy + 1], [cx, cy - 1]] as [number, number][]) {
          if (nx >= 0 && nx < size && ny >= 0 && ny < size && !visited[ny][nx] && grid[ny][nx]?.tile === terrain) {
            queue.push([nx, ny]);
          }
        }
      }

      total += regionSize * regionCrowns;
    }
  }
  return total;
};

/** BFS flood-fill: size of the largest single contiguous terrain region (castle excluded). */
export const largestRegion = (grid: Board): number => {
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

        for (const [nx, ny] of [[cx + 1, cy], [cx - 1, cy], [cx, cy + 1], [cx, cy - 1]] as [number, number][]) {
          if (nx >= 0 && nx < size && ny >= 0 && ny < size && !visited[ny][nx] && grid[ny][nx]?.tile === terrain) {
            queue.push([nx, ny]);
          }
        }
      }

      if (regionSize > maxSize) maxSize = regionSize;
    }
  }
  return maxSize;
};

/** Sum of all crown values across all terrain tiles (castle excluded). */
export const totalCrowns = (grid: Board): number => {
  let total = 0;
  for (const row of grid) {
    for (const cell of row) {
      if (cell?.tile) total += cell.value ?? 0;
    }
  }
  return total;
};

/** True if the castle at (6,6) is at the center of the bounding box of all placed tiles. */
export const isCastleCentered = (grid: Board): boolean => {
  const CASTLE = 6;
  let minX = CASTLE, maxX = CASTLE, minY = CASTLE, maxY = CASTLE;
  for (let y = 0; y < grid.length; y++) {
    for (let x = 0; x < grid[y].length; x++) {
      if (grid[y][x]?.tile !== undefined) {
        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
        if (y < minY) minY = y;
        if (y > maxY) maxY = y;
      }
    }
  }
  return minX + maxX === CASTLE * 2 && minY + maxY === CASTLE * 2;
};
