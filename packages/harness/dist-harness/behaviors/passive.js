/**
 * Passive behavior — picks the legal action with lowest impact.
 *
 * Prefers safe, conservative moves over aggressive ones.
 * Useful for testing without interference from AI aggression.
 */
/**
 * PassiveBehavior picks the action that minimizes impact or changes.
 *
 * Strategy:
 * 1. Look for a 'pass' or 'end_turn' action (lowest impact)
 * 2. Otherwise pick the first legal action (safest)
 */
export class PassiveBehavior {
    chooseAction(state, playerId) {
        const stateObj = state;
        if (!stateObj.getLegalActions) {
            throw new Error('PassiveBehavior: state must have getLegalActions method');
        }
        const legalActions = stateObj.getLegalActions(playerId);
        if (legalActions.length === 0) {
            throw new Error(`PassiveBehavior: no legal actions available for player ${playerId}`);
        }
        // Look for a pass/end_turn action first (safest)
        for (const action of legalActions) {
            const actionName = this.getActionName(action);
            if (actionName === 'pass' ||
                actionName === 'end_turn' ||
                actionName === 'pass_turn') {
                return action;
            }
        }
        // Otherwise return first (conservative fallback)
        return legalActions[0];
    }
    getActionName(action) {
        if (typeof action === 'string')
            return action;
        if (typeof action === 'object' && action !== null) {
            const obj = action;
            return String(obj.action || obj.name || '');
        }
        return '';
    }
}
//# sourceMappingURL=passive.js.map