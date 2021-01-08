import { castle, getCard } from "./utils";

const range = (len) => [...Array(len).keys()];

// Max board size is 13 x 13
const getEmptyBoard = () =>
  range(13).map((r) => range(13).map((x) => ({ tile: null })));

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
    };
    thisBoard[x][y + 1] = {
      tile: tileB,
    };
  });
  return thisBoard;
};
