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

  console.log("flipping", x, y, direction);

  const flippedX = x + xDirection[direction];
  const flippedY = y + yDirection[direction];
  const flippedDirection = oppositeDirection[direction];

  console.log("flipping", { x, y, direction }, { flippedX, flippedY, flippedDirection });
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
  if (!cardId) {
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
    .filter(({ x, y }) => !tileIsValid(board, x, y))
    .map(({ x: _x, y: _y, direction }) => direction);

const directionDelta: Record<Direction, { dx: number; dy: number }> = {
  [up]: { dx: 0, dy: -1 },
  [right]: { dx: 1, dy: 0 },
  [down]: { dx: 0, dy: 1 },
  [left]: { dx: -1, dy: 0 },
};

const directionPriority: Direction[] = [up, right, down, left];

const staysWithin5x5 = (
  board: Board,
  x: number,
  y: number,
  direction: Direction,
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

  return width <= 5 && height <= 5;
};

export const findPlacementWithin5x5 = (
  board: Board,
  cardId: CardId,
): { x: number; y: number; direction: Direction } | null => {
  const candidateAnchors = getEligiblePositions(board, cardId).sort(
    (a, b) => a.y - b.y || a.x - b.x,
  );

  for (const { x, y } of candidateAnchors) {
    const directions = (getValidDirections(board, cardId, x, y) as Direction[]).sort(
      (a, b) => directionPriority.indexOf(a) - directionPriority.indexOf(b),
    );
    const validDirection = directions.find((direction) =>
      staysWithin5x5(board, x, y, direction),
    );
    if (validDirection !== undefined) {
      return { x, y, direction: validDirection };
    }
  }

  return null;
};
