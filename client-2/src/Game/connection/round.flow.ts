import { getNextFourCards } from "../gamelogic/utils";
import { buildTrustedSeed } from "./game.flow";

export const prepForNextRound = async ({ gameConnection, currentDeck }) => {
  // Deal out some cards
  const { nextCards, remainingDeck } = await trustedDeal({
    gameConnection,
    currentDeck,
  });

  return {
    nextCards,
    remainingDeck,
  };
};

const trustedDeal = async ({ gameConnection, currentDeck }) => {
  const trustedSeed = await buildTrustedSeed(gameConnection);

  // - each 4-draw, recommit and re-shuffle
  //   - important to re-randomize every turn, or future knowledge will help mis-behaving clients
  const { next, remaining } = getNextFourCards(trustedSeed, currentDeck);
  return { nextCards: next, remainingDeck: remaining };
};
