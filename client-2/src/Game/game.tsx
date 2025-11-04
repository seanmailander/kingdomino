import "react";

import "./game.css";
import BoardArea from "./BoardArea";
import type { GameConnection } from "./types";
import { useChooseOrder, usePlayedCards, useWhoseTurn } from "./game.effects";
import Card from "./Card";
// import { getDeal } from "./round.slice";

type GameProps = {
  gameConnection: GameConnection;
};

export function GameScene({ gameConnection }: GameProps) {
  const chosenOrder = useChooseOrder(gameConnection);
  const { playedCards, ...playedCardsHandlers } = usePlayedCards();
  const { isMyTurn, ...whoseTurnHandlers } = useWhoseTurn({
    myPlayerId: "",
  });

  const deal = [];

  // const { triggerCardPlaced } = useGame(gameConnection);

  const handleCardPicked = () => {
    // Picked but not placed
  };

  return (
    <>
      <div className="deal">
        {deal?.map((card) => (
          <Card
            key={card.id}
            card={card}
            isMyTurn={isMyTurn}
            onCardPicked={handleCardPicked}
          />
        ))}
      </div>
      <div className="boards">
        {gameConnection.players.map(({ playerId, isMe }) => (
          <BoardArea
            key={playerId}
            playerId={playerId}
            isMe={isMe}
            myBoard={[]}
            cardId={1}
            isMyPlace={isMe && isMyTurn}
          />
        ))}
      </div>
    </>
  );
}
