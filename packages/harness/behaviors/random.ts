/**
 * Random behavior — picks a random legal action.
 *
 * Uses the seeded RNG to ensure deterministic randomness.
 * Never attempts illegal moves.
 */

import type { ClientBehavior } from './index.ts'

/**
 * RandomBehavior picks randomly from the available legal actions.
 *
 * Requires the game state to have a getLegalActions() method.
 */
export class RandomBehavior implements ClientBehavior {
  chooseAction(state: unknown, playerId: string, rng: () => number): unknown {
    // Note: In STEP 5, state will be GameState with getLegalActions method
    // For now, this shows the intent
    const stateObj = state as {
      getLegalActions?: (playerId: string) => unknown[]
    }

    if (!stateObj.getLegalActions) {
      throw new Error('RandomBehavior: state must have getLegalActions method')
    }

    const legalActions = stateObj.getLegalActions(playerId)
    if (legalActions.length === 0) {
      throw new Error(
        `RandomBehavior: no legal actions available for player ${playerId}`,
      )
    }

    // Pick random index using seeded RNG
    const randomIndex = Math.floor(rng() * legalActions.length)
    return legalActions[randomIndex]
  }
}
