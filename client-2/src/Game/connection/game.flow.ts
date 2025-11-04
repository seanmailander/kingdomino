import { generateDeck } from "../gamelogic/cards";
import {
  chooseOrderFromSeed,
  combine,
  commit,
  verify,
} from "../gamelogic/utils";
import type { GameConnection } from "../types";
import {
  COMMITTMENT,
  committmentMessage,
  REVEAL,
  revealMessage,
} from "./game.messages";
import { eachRound, prepForNextRound } from "./round.flow";

// - A chooses a random number Ra
// - A calculates hash Ha = H(Ra)
// - A shares committment Ha
// - B chooses a random number Rb
// - B calculates hash Hb = H(Rb)
// - B shares committment Hb
// - Both A and B reveal Ra and Rb
// - Both A and B verify committments
// - Both A and B calculate shared random as G = H (Ra || Rb)

type BuildTrustedSeedProps = {
  gameConnection: GameConnection;
};
export const buildTrustedSeed = async ({
  gameConnection,
}: BuildTrustedSeedProps) => {
  console.debug("building trusted seed");
  const { secret: mySecret, committment: myCommittment } = await commit();
  gameConnection.sendGameMessage(committmentMessage(myCommittment));

  const { committment: theirCommittment } =
    await gameConnection.waitForGameMessage(COMMITTMENT);

  gameConnection.sendGameMessage(revealMessage(mySecret));

  const { secret: theirSecret } =
    await gameConnection.waitForGameMessage(REVEAL);

  await verify(theirSecret, theirCommittment);
  console.debug("done building trusted seed");
  return combine(mySecret, theirSecret);
};

const getPeerIdentifiers = (gameConnection: GameConnection) => ({
  me: gameConnection.players.find((p) => p.isMe)?.playerId ?? "",
  them: gameConnection.players.find((p) => !p.isMe)?.playerId ?? "",
});

type ChooseOrderProps = {
  gameConnection: GameConnection;
};
export const chooseOrder = async ({ gameConnection }: ChooseOrderProps) => {
  // Get a shared seed so its random who goes first
  const firstSeed = await buildTrustedSeed({ gameConnection });

  const peerIdentifiers = getPeerIdentifiers(gameConnection);

  // Now use that seed to sort the peer identifiers
  const choosenOrder = chooseOrderFromSeed(firstSeed, peerIdentifiers);
  return choosenOrder;
};

export const wholeGame = async ({
  gameConnection,
  onGameStarted,
  onNextRound,
  onGameEnded,
}) => {
  onGameStarted();
  // First round!
  const wholeDeck = generateDeck();
  let nextRound = await prepForNextRound({
    gameConnection,
    currentDeck: wholeDeck,
  });
  onNextRound(nextRound);
  // Subsequent rounds
  while (nextRound.remainingDeck.length > 0) {
    // TODO: handle cancellation mid-game
    // We dont want this function hanging around forever
    
    nextRound = await prepForNextRound({
      gameConnection,
      currentDeck: nextRound.remainingDeck,
    });
    onNextRound(nextRound);
  }

  onGameEnded();
};
