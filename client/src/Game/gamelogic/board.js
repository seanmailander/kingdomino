import { castle, getCard, up, down, left, right } from "./cards";

const range = (len) => [...Array(len).keys()];

// Max board size is 13 x 13
export const getEmptyBoard = () =>
  range(13).map((r) => range(13).map((x) => ({ tile: null })));

const xDirection = {
  [up]: -1,
  [right]: 0,
  [down]: 1,
  [left]: 0,
};

const yDirection = {
  [up]: 0,
  [right]: 1,
  [down]: 0,
  [left]: -1,
};

const placeCardOnBoard = (board) => ({ card, x, y, direction }) => {
  const {
    tiles: [{ tile: tileA, value: valueA }, { tile: tileB, value: valueB }],
  } = getCard(card);

  board[y][x] = {
    tile: tileA,
    value: valueA,
  };
  const xB = x + xDirection[direction];
  const yB = y + yDirection[direction];

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
  console.debug("enriching", x, y);
  if (!(x ?? y)) {
    return board;
  }
  return placeCardOnBoard(board)({ card, x, y, direction });
};
