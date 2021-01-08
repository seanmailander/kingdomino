import { castle, getCard, up, down, left, right } from "./cards";

const range = (len) => [...Array(len).keys()];

// Max board size is 13 x 13
const getEmptyBoard = () =>
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

export const placedCardsToBoard = (placedCards) => {
  const thisBoard = getEmptyBoard();
  thisBoard[6][6] = {
    tile: castle,
  };

  placedCards?.forEach(({ card: cardId, x, y, direction }) => {
    const {
      tiles: [{ tile: tileA, value: valueA }, { tile: tileB, value: valueB }],
    } = getCard(cardId);
    thisBoard[x][y] = {
      tile: tileA,
      value: valueA,
    };
    const xB = x + xDirection[direction];
    const yB = y + yDirection[direction];

    thisBoard[xB][yB] = {
      tile: tileB,
      value: valueB,
    };
  });
  return thisBoard;
};
