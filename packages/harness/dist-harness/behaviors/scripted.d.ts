/**
 * Scripted behavior — follows a predetermined sequence of actions.
 *
 * Used for deterministic testing: provide an exact sequence of moves
 * and the agent will play them in order. Throws if script is exhausted.
 */
import { ClientBehavior } from './index';
/**
 * ScriptedBehavior executes a sequence of predetermined actions.
 *
 * @example
 * new ScriptedBehavior(['draw', 'play_card:fireball', 'end_turn'])
 */
export declare class ScriptedBehavior implements ClientBehavior {
    private script;
    private index;
    constructor(script: string[]);
    chooseAction(): unknown;
}
//# sourceMappingURL=scripted.d.ts.map