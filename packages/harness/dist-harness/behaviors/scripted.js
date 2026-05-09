/**
 * Scripted behavior — follows a predetermined sequence of actions.
 *
 * Used for deterministic testing: provide an exact sequence of moves
 * and the agent will play them in order. Throws if script is exhausted.
 */
/**
 * ScriptedBehavior executes a sequence of predetermined actions.
 *
 * @example
 * new ScriptedBehavior(['draw', 'play_card:fireball', 'end_turn'])
 */
export class ScriptedBehavior {
    script;
    index = 0;
    constructor(script) {
        this.script = script;
    }
    chooseAction() {
        if (this.index >= this.script.length) {
            throw new Error(`Scripted behavior exhausted: requested action ${this.index} but only ${this.script.length} actions provided`);
        }
        const action = this.script[this.index];
        this.index++;
        // Parse the action string into action name and parameters
        // Format: 'action_name' or 'action_name:param1:param2'
        const [actionName, ...params] = action.split(':');
        if (params.length === 0) {
            return { action: actionName };
        }
        // If params provided, treat them as key-value pairs
        // For now, just return as params object
        return {
            action: actionName,
            params: Object.fromEntries(params.map((p, i) => [
                `param${i}`,
                isNaN(Number(p)) ? p : Number(p),
            ])),
        };
    }
}
//# sourceMappingURL=scripted.js.map