import type { BoardCell } from "../state/Board";
import { castle, validTiles, getCard, up, down, left, right } from "./cards";
import type { Direction } from "../state/types";
import type { CardId } from "../state/types";

type Board = ReadonlyArray<ReadonlyArray<BoardCell>>;
type MutableBoard = BoardCell[][];
type Position = { x: number; y: number };
type Neighbor = Position & { direction: Direction };
type Placement = { card: CardId; x: number; y: number; direction: Direction };

const range = (len: number): number[] => [...Array(len).keys()];

// Max board size is 13 x 13
export const getEmptyBoard: () => MutableBoard = () =>
  range(13).map((r) => range(13).map((x) => ({ tile: undefined })));

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

const deepCopy = (a1: Board): MutableBoard => [...a1.map((a2) => [...a2])];

const placeCardOnBoard =
  (board: MutableBoard) =>
  ({ card, x, y, direction }: Placement): MutableBoard => {
    const xB = x + xDirection[direction];
    const yB = y + yDirection[direction];

    if (!isWithinBounds({ x: xB, y: yB })) {
      return board;
    }

    const {
      tiles: [{ tile: tileA, value: valueA }, { tile: tileB, value: valueB }],
    } = getCard(card);

    board[y][x] = {
      tile: tileA,
      value: valueA,
    };

    board[yB][xB] = {
      tile: tileB,
      value: valueB,
    };
    return board;
  };

export const placedCardsToBoard = (placedCards?: ReadonlyArray<Placement>): Board => {
  const thisBoard = getEmptyBoard();
  thisBoard[6][6] = {
    tile: castle,
  };

  // Modify the board in-place
  placedCards?.forEach(placeCardOnBoard(thisBoard));
  return thisBoard;
};

export const enrichBoardWithCard = (
  board: Board,
  card: CardId,
  x: number | null,
  y: number | null,
  direction: Direction,
): Board => {
  if (x === null || y === null || !board) {
    return board;
  }

  const boardCopy = deepCopy(board);

  return placeCardOnBoard(boardCopy)({ card, x, y, direction });
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
  const allPositions = board.reduce<Array<{ card: BoardCell; x: number; y: number }>>((prev, curr, y) => {
    return [...prev, ...curr.map((card, x) => ({ card, x, y }))];
  }, []);

  const { type } = getCard(cardId);
  const onlyPlayedSpots = ({ card }: { card: BoardCell }) => card?.tile !== null;
  const onlyMatchingTiles = ({ card }: { card: BoardCell }) => card.tile === 0 || !!(card.tile & type);

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
    .map(({ x, y, direction }) => direction);
