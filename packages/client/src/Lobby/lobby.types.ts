import type { MultiplayerConnection } from "kingdomino-protocol";

export const SLOT_LOCAL  = "local"  as const;
export const SLOT_COUCH  = "couch"  as const;
export const SLOT_AI     = "ai"     as const;
export const SLOT_REMOTE = "remote" as const;

export type PlayerSlotType = typeof SLOT_LOCAL | typeof SLOT_COUCH | typeof SLOT_AI | typeof SLOT_REMOTE

export type PlayerSlotConfig = {
  type: PlayerSlotType;
  /** Populated for SLOT_REMOTE once matchmaking completes */
  peerId?: string;
  /** The established WebRTC connection; only set for SLOT_REMOTE */
  connection?: MultiplayerConnection;
}

/** 2, 3, or 4 player slots — enforced at the type level. */
export type RosterConfig =
  | [PlayerSlotConfig, PlayerSlotConfig]
  | [PlayerSlotConfig, PlayerSlotConfig, PlayerSlotConfig]
  | [PlayerSlotConfig, PlayerSlotConfig, PlayerSlotConfig, PlayerSlotConfig]
