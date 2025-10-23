import type { MovePayload } from "../types";

export const START = "START";
export const COMMITTMENT = "COMMITTMENT";
export const REVEAL = "REVEAL";
export const MOVE = "MOVE";

export const startMessage = () => ({ type: START });
export const committmentMessage = (committment: string) => ({
  type: COMMITTMENT,
  content: { committment },
});
export const revealMessage = (secret: string) => ({
  type: REVEAL,
  content: { secret },
});
export const moveMessage = (move: MovePayload) => ({
  type: MOVE,
  content: { move },
});
