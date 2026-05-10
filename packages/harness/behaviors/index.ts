/**
 * Client behavior interface and registry.
 *
 * Each behavior determines how a player chooses actions in the game.
 * The agent can use different behaviors for different players to test
 * various game scenarios.
 */

import { ScriptedBehavior } from './scripted.ts'
import { RandomBehavior } from './random.ts'
import { PassiveBehavior } from './passive.ts'
import { AggressiveBehavior } from './aggressive.ts'
import { CheaterBehavior } from './cheater.ts'

/**
 * Specification for a client behavior at game initialization.
 *
 * @example
 * { behavior: 'scripted', script: ['draw', 'play_card', 'end_turn'] }
 * { behavior: 'random' }
 * { behavior: 'passive' }
 * { behavior: 'aggressive' }
 * { behavior: 'cheater' }
 */
export type BehaviorSpec =
  | { behavior: 'scripted'; script: string[] }
  | { behavior: 'random' }
  | { behavior: 'passive' }
  | { behavior: 'aggressive' }
  | { behavior: 'cheater' }

/**
 * Core behavior interface.
 *
 * Implementations decide what action a player should take given
 * the current game state and available actions.
 */
export interface ClientBehavior {
  /**
   * Choose an action for this player.
   *
   * @param state - Current game state
   * @param playerId - The player making the decision
   * @param rng - Seeded random number generator for deterministic randomness
   * @returns An action (typically the action name/ID and parameters)
   * @throws Error if unable to choose (e.g., no legal actions, script exhausted)
   */
  chooseAction(
    state: unknown,
    playerId: string,
    rng: () => number,
  ): unknown
}

/**
 * Resolve a behavior spec into a concrete behavior implementation.
 *
 * @param spec - Behavior specification
 * @returns Instantiated behavior
 * @throws Error if spec is invalid or unsupported
 */
export function resolveBehavior(spec: BehaviorSpec): ClientBehavior {
  if (typeof spec === 'object' && spec !== null) {
    const s = spec as Record<string, unknown>
    switch (s.behavior) {
      case 'scripted':
        return new ScriptedBehavior(s.script as string[])
      case 'random':
        return new RandomBehavior()
      case 'passive':
        return new PassiveBehavior()
      case 'aggressive':
        return new AggressiveBehavior()
      case 'cheater':
        return new CheaterBehavior()
      default:
        throw new Error(`Unknown behavior: ${s.behavior}`)
    }
  }
  throw new Error('Invalid behavior spec')
}
