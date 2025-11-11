import type { MovePayload } from "../types";

export const START = "START" as const;
export const COMMITTMENT = "COMMITTMENT" as const;
export const REVEAL = "REVEAL" as const;
export const MOVE = "MOVE" as const;

export const startMessage = () => ({ type: START, content: undefined });
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

export type ValidMessages =
  | ReturnType<typeof startMessage>
  | ReturnType<typeof committmentMessage>
  | ReturnType<typeof revealMessage>
  | ReturnType<typeof moveMessage>;

export type ValidMessageTypes = ValidMessages["type"];