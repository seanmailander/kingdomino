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
  const pickOrder = getPickOrder();
  if (pickOrder.length === 0) {
    // No turns left
    onRoundEnd();
    return;
  }

  const playerId = yield select(getMyPlayerId);
  const isMyTurn = pickOrder[0] === playerId;

  wholeGame({
    gameConnection,
    onGameStarted,
    onNextRound,
    onGameEnded,
  });
};
