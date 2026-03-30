export type PlayerSlotType = 'local' | 'couch' | 'ai' | 'remote'

export type PlayerSlotConfig = {
  type: PlayerSlotType
  /** Required when type === 'remote' */
  peerId?: string
}

/** 2, 3, or 4 player slots — enforced at the type level. */
export type RosterConfig =
  | [PlayerSlotConfig, PlayerSlotConfig]
  | [PlayerSlotConfig, PlayerSlotConfig, PlayerSlotConfig]
  | [PlayerSlotConfig, PlayerSlotConfig, PlayerSlotConfig, PlayerSlotConfig]
