/**
 * Aggressive behavior — picks the action that maximizes score/damage.
 *
 * Prioritizes high-impact moves that benefit this player or harm opponents.
 */

import type { ClientBehavior } from './index.ts'

/**
 * AggressiveBehavior picks the action with highest estimated impact.
 *
 * Strategy:
 * 1. Avoid 'pass' or 'end_turn' actions
 * 2. Prefer actions that modify state (not just observers)
 * 3. If multiple options, pick the last one (convention: usually highest value)
 */
export class AggressiveBehavior implements ClientBehavior {
  chooseAction(state: unknown, playerId: string): unknown {
    const stateObj = state as {
      getLegalActions?: (playerId: string) => unknown[]
    }

    if (!stateObj.getLegalActions) {
      throw new Error(
        'AggressiveBehavior: state must have getLegalActions method',
      )
    }

    const legalActions = stateObj.getLegalActions(playerId)
    if (legalActions.length === 0) {
      throw new Error(
        `AggressiveBehavior: no legal actions available for player ${playerId}`,
      )
    }

    // Filter out passive actions (pass, end_turn)
    const aggressiveActions = legalActions.filter((action) => {
      const actionName = this.getActionName(action)
      return (
        actionName !== 'pass' &&
        actionName !== 'end_turn' &&
        actionName !== 'pass_turn'
      )
    })

    // If we found aggressive actions, pick the last one (convention: usually highest value)
    if (aggressiveActions.length > 0) {
      return aggressiveActions[aggressiveActions.length - 1]
    }

    // If only passive actions available, pick the last one
    return legalActions[legalActions.length - 1]
  }

  private getActionName(action: unknown): string {
    if (typeof action === 'string') return action
    if (typeof action === 'object' && action !== null) {
      const obj = action as Record<string, unknown>
      return String(obj.action || obj.name || '')
    }
    return ''
  }
}
