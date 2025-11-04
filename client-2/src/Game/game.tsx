import "react";

import "./game.css";
import BoardArea from "./BoardArea";
import type { GameConnection } from "./types";
import { useChooseOrder, useWhoseTurn } from "./game.effects";
// import Card from "./Card";
// import { getDeal } from "./round.slice";

type GameProps = {
  gameConnection: GameConnection;
};

export function GameScene({ gameConnection }: GameProps) {
  const chosenOrder = useChooseOrder(gameConnection);
  const { isMyTurn, pickOrder, handleCardPlayed, handleRoundEnded } =
    useWhoseTurn({ myPlayerId: "" });

  return (
    <>
      <div className="deal">
        {/* {deal?.map((card) => <Card key={card.id} card={card} />)} */}
      </div>
      <div className="boards">
        {players.map(({ playerId, isMe }) => (
          <BoardArea key={playerId} playerId={playerId} isMe={isMe} />
        ))}
      </div>
    </>
  );
}
