import { commit, verify, combine } from "../gamelogic/utils";

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
export const moveMessage = (move) => ({ type: MOVE, content: { move } });

export type WaitForGameMessage = <T = unknown>(messageType: string) => Promise<T>;
export type SendGameMessage = (message: { type: string; content?: unknown }) => void;

// - A chooses a random number Ra
// - A calculates hash Ha = H(Ra)
// - A shares committment Ha
// - B chooses a random number Rb
// - B calculates hash Hb = H(Rb)
// - B shares committment Hb
// - Both A and B reveal Ra and Rb
// - Both A and B verify committments
// - Both A and B calculate shared random as G = H (Ra || Rb)

export async function buildTrustedSeed(
  sendGameMessage: SendGameMessage,
  waitForGameMessage: WaitForGameMessage,
) {
  console.debug("building trusted seed");
  const { secret: mySecret, committment: myCommittment } = await commit();
  sendGameMessage(committmentMessage(myCommittment));

  const { committment: theirCommittment } = await waitForGameMessage<{ committment: string }>(
    COMMITTMENT,
  );

  sendGameMessage(revealMessage(mySecret));

  const { secret: theirSecret } = await waitForGameMessage<{ secret: string }>(REVEAL);

  await verify(theirSecret, theirCommittment);
  const theirSecretAsNumber = Number(theirSecret);
  if (isNaN(theirSecretAsNumber)) {
    throw new Error("Their secret is not a valid number");
  }
  console.debug("done building trusted seed");
  return combine(mySecret, theirSecretAsNumber);
}
