export type PlayerSlotType = 'local' | 'couch' | 'ai' | 'remote'

export type PlayerSlotConfig = {
  type: PlayerSlotType
  /** Required when type === 'remote' */
  peerId?: string
}

/** Minimum 2, maximum 4 players (runtime guard enforced in DefaultRosterFactory) */
export type RosterConfig = [PlayerSlotConfig, PlayerSlotConfig, ...PlayerSlotConfig[]]
