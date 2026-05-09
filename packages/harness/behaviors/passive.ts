/**
 * Passive behavior — picks the legal action with lowest impact.
 *
 * Prefers safe, conservative moves over aggressive ones.
 * Useful for testing without interference from AI aggression.
 */

import { ClientBehavior } from './index'

/**
 * PassiveBehavior picks the action that minimizes impact or changes.
 *
 * Strategy:
 * 1. Look for a 'pass' or 'end_turn' action (lowest impact)
 * 2. Otherwise pick the first legal action (safest)
 */
export class PassiveBehavior implements ClientBehavior {
  chooseAction(state: unknown, playerId: string): unknown {
    const stateObj = state as {
      getLegalActions?: (playerId: string) => unknown[]
    }

    if (!stateObj.getLegalActions) {
      throw new Error('PassiveBehavior: state must have getLegalActions method')
    }

    const legalActions = stateObj.getLegalActions(playerId)
    if (legalActions.length === 0) {
      throw new Error(
        `PassiveBehavior: no legal actions available for player ${playerId}`,
      )
    }

    // Look for a pass/end_turn action first (safest)
    for (const action of legalActions) {
      const actionName = this.getActionName(action)
      if (
        actionName === 'pass' ||
        actionName === 'end_turn' ||
        actionName === 'pass_turn'
      ) {
        return action
      }
    }

    // Otherwise return first (conservative fallback)
    return legalActions[0]
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
