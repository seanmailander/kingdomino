import { useEffect, useState } from "react";

import type { GameConnection } from "./types";
import { chooseOrder, wholeGame } from "./connection/game.flow";

export const useChooseOrder = (gameConnection: GameConnection) => {
  const [chosenOrder, setChosenOrder] = useState<string[] | undefined>(
    undefined,
  );
  useEffect(() => {
    async function waitForPlayersToAgreeOnOrder() {
      const newChosenOrder = await chooseOrder({ gameConnection });

      setChosenOrder(newChosenOrder);
    }

    waitForPlayersToAgreeOnOrder();
  }, [gameConnection]);

  return chosenOrder;
};

export const useNextRound = (gameConnection: GameConnection) => {
  // Inputs:
  //  - remainding deck from prior rounds
  //  - pick order from prior rounds
  // Whose turn?
  // const pickOrder = getPickOrder();
  // if (pickOrder.length === 0) {
  //   // No turns left
  //   onRoundEnd();
  //   return;
  // }
  // const playerId = yield select(getMyPlayerId);
  // const isMyTurn = pickOrder[0] === playerId;
  // wholeGame({
  //   gameConnection,
  //   onGameStarted,
  //   onNextRound,
  //   onGameEnded,
  // });
};

export const usePlayedCards = () => {
  // Track all placed cards
  const [playedCards, setPlayedCards] = useState([]);
  const handleCardPlayed = ({ playerId, card, x, y, direction }) => {
    setPlayedCards([
      ...playedCards,
      {
        playerId,
        card,
        x,
        y,
        direction,
      },
    ]);
  };

  return {
    playedCards,
    handleCardPlayed,
  };
};

export const useWhoseTurn = ({ myPlayerId }) => {
  // Track whose turn, built upon choices prior turn
  const [pickOrderThisRound, setPickOrderThisRound] = useState(new Array(4));
  const [pickOrderNextRound, setPickOrderNextRound] = useState(new Array(4));
  const handleCardPlayed = ({ playerId, card, deal }) => {
    const placeInDeal = deal.findIndex((c) => c === card);
    // Remove this pick from this round
    setPickOrderThisRound(pickOrderThisRound.slice(1));

    // Add this player to the right turn next round
    pickOrderNextRound[placeInDeal] = playerId;
    setPickOrderNextRound(pickOrderNextRound);
  };

  const handleRoundEnded = () => {
    setPickOrderThisRound(pickOrderNextRound);
    setPickOrderNextRound(new Array(4));
  };

  const isMyTurn =
    pickOrderThisRound.length > 0 && pickOrderThisRound[0] === myPlayerId;

  return {
    isMyTurn,
    pickOrder: pickOrderThisRound,
    handleCardPlayed,
    handleRoundEnded,
  };
};