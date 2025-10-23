import { combine, commit, verify } from "../gamelogic/utils";
import type { GameConnection } from "../types";
import {
  COMMITTMENT,
  committmentMessage,
  REVEAL,
  revealMessage,
} from "./game.messages";

// - A chooses a random number Ra
// - A calculates hash Ha = H(Ra)
// - A shares committment Ha
// - B chooses a random number Rb
// - B calculates hash Hb = H(Rb)
// - B shares committment Hb
// - Both A and B reveal Ra and Rb
// - Both A and B verify committments
// - Both A and B calculate shared random as G = H (Ra || Rb)

export const buildTrustedSeed = async (
  sendGameMessage: GameConnection["sendGameMessage"],
  waitForGameMessage: GameConnection["waitForGameMessage"],
) => {
  console.debug("building trusted seed");
  const { secret: mySecret, committment: myCommittment } = await commit();
  sendGameMessage(committmentMessage(myCommittment));

  const { committment: theirCommittment } =
    await waitForGameMessage(COMMITTMENT);

  sendGameMessage(revealMessage(mySecret));

  const { secret: theirSecret } = await waitForGameMessage(REVEAL);

  await verify(theirSecret, theirCommittment);
  console.debug("done building trusted seed");
  return combine(mySecret, theirSecret);
};
