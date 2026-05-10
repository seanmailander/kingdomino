/**
 * Scripted behavior — follows a predetermined sequence of actions.
 *
 * Used for deterministic testing: provide an exact sequence of moves
 * and the agent will play them in order. Throws if script is exhausted.
 */

import type { ClientBehavior } from './index.ts'

/**
 * ScriptedBehavior executes a sequence of predetermined actions.
 *
 * @example
 * new ScriptedBehavior(['draw', 'play_card:fireball', 'end_turn'])
 */
export class ScriptedBehavior implements ClientBehavior {
  private script: string[]
  private index: number = 0

  constructor(script: string[]) {
    this.script = script
  }

  chooseAction(): unknown {
    if (this.index >= this.script.length) {
      throw new Error(
        `Scripted behavior exhausted: requested action ${this.index} but only ${this.script.length} actions provided`,
      )
    }

    const action = this.script[this.index]
    this.index++

    // Parse the action string into action name and parameters
    // Format: 'action_name' or 'action_name:param1:param2'
    const [actionName, ...params] = action.split(':')

    if (params.length === 0) {
      return { action: actionName }
    }

    // Parse game-specific params by action type:
    //   pick:<cardId>           → { cardId: number }
    //   place:<x>:<y>:<dir>     → { x: number, y: number, direction: string }
    //   discard                 → {} (no params)
    if (actionName === 'pick' && params.length >= 1) {
      return { action: 'pick', params: { cardId: Number(params[0]) } }
    }
    if (actionName === 'place' && params.length >= 3) {
      return {
        action: 'place',
        params: { x: Number(params[0]), y: Number(params[1]), direction: params[2] },
      }
    }
    return { action: actionName, params: {} }
  }
}
