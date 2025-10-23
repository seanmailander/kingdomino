import { Board } from "../types";
import { castle, validTiles, getCard, up, down, left, right } from "./cards";

const range = (len) => [...Array(len).keys()];

// Max board size is 13 x 13
export const getEmptyBoard: () => Board = () =>
  range(13).map((r) => range(13).map((x) => ({ tile: undefined })));

const xDirection = {
  [up]: 0,
  [right]: 1,
  [down]: 0,
  [left]: -1,
};
const yDirection = {
  [up]: -1,
  [right]: 0,
  [down]: 1,
  [left]: 0,
};

export const getFlippedPosition = (x, y, direction, flipped) => {
  if (!flipped) {
    return { flippedX: x, flippedY: y, flippedDirection: direction };
  }

  console.log("flipping", x, y, direction);

  const flippedX = x + xDirection[direction];
  const flippedY = y + yDirection[direction];
  const flippedDirection = (direction + 2) % 4;

  console.log(
    "flipping",
    { x, y, direction },
    { flippedX, flippedY, flippedDirection },
  );
  return {
    flippedX,
    flippedY,
    flippedDirection,
  };
};

const deepCopy = (a1) => [...a1.map((a2) => [...a2])];

const placeCardOnBoard =
  (board) =>
  ({ card, x, y, direction }) => {
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

export const placedCardsToBoard = (placedCards) => {
  const thisBoard = getEmptyBoard();
  thisBoard[6][6] = {
    tile: castle,
  };

  // Modify the board in-place
  placedCards?.forEach(placeCardOnBoard(thisBoard));
  return thisBoard;
};

export const enrichBoardWithCard = (board, card, x, y, direction) => {
  if (x === null || y === null || !board) {
    return board;
  }

  const boardCopy = deepCopy(board);

  return placeCardOnBoard(boardCopy)({ card, x, y, direction });
};

const tileIsValid = (board, x, y) =>
  board && validTiles.some((d) => d === board[y][x]?.tile);
const isWithinBounds = ({ x, y }) => x >= 0 && x <= 12 && y >= 0 && y <= 12;
const getNeighbors = (x, y) =>
  [
    { x: x + 1, y, direction: right },
    { x: x - 1, y, direction: left },
    { x, y: y + 1, direction: down },
    { x, y: y - 1, direction: up },
  ].filter(isWithinBounds);

export const getEligiblePositions = (board, cardId) => {
  if (!cardId) {
    return [];
  }
  const allPositions = board.reduce((prev, curr, y) => {
    return [...prev, ...curr.map((card, x) => ({ card, x, y }))];
  }, []);

  const { type } = getCard(cardId);
  const onlyPlayedSpots = ({ card }) => card?.tile !== null;
  const onlyMatchingTiles = ({ card }) =>
    card.tile === 0 || !!(card.tile & type);

  const playedSpots = allPositions
    .filter(onlyPlayedSpots)
    .filter(onlyMatchingTiles);

  const validNeighbors = playedSpots.reduce(
    (prev, { x, y }) => [
      ...prev,
      ...getNeighbors(x, y).filter(({ x, y }) => !tileIsValid(board, x, y)),
    ],
    [],
  );

  return validNeighbors;
};

export const getValidDirections = (board, card, tileX, tileY) =>
  getNeighbors(tileX, tileY)
    .filter(({ x, y }) => !tileIsValid(board, x, y))
    .filter(({ x, y }) => !tileIsValid(board, x, y))
    .map(({ x, y, direction }) => direction);
