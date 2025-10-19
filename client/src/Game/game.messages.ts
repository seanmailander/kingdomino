import { commit, verify, combine } from "./gamelogic/utils";
import { MovePayload } from "./types";

export const START = "START";
export const COMMITTMENT = "COMMITTMENT";
export const REVEAL = "REVEAL";
export const MOVE = "MOVE";

export const startMessage = () => ({ type: START });
export const committmentMessage = (committment) => ({
  type: COMMITTMENT,
  content: { committment },
});
export const revealMessage = (secret) => ({
  type: REVEAL,
  content: { secret },
});
export const moveMessage = (move: MovePayload) => ({ type: MOVE, content: { move } });

// - A chooses a random number Ra
// - A calculates hash Ha = H(Ra)
// - A shares committment Ha
// - B chooses a random number Rb
// - B calculates hash Hb = H(Rb)
// - B shares committment Hb
// - Both A and B reveal Ra and Rb
// - Both A and B verify committments
// - Both A and B calculate shared random as G = H (Ra || Rb)

export const buildTrustedSeed = async (sendGameMessage, waitForGameMessage) => {
  const onCommit = waitForGameMessage(COMMITTMENT);
  const onReveal = waitForGameMessage(REVEAL);

  console.debug("building trusted seed");
  const { secret: mySecret, committment: myCommittment } = await commit();
  sendGameMessage(committmentMessage(myCommittment));

  const { committment: theirCommittment } = await onCommit();

  sendGameMessage(revealMessage(mySecret));

  const { secret: theirSecret } = await onReveal();

  await verify(theirSecret, theirCommittment);
  console.debug("done building trusted seed");
  return combine(mySecret, theirSecret);
};
