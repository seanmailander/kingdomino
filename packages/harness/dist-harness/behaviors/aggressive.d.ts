/**
 * Aggressive behavior — picks the action that maximizes score/damage.
 *
 * Prioritizes high-impact moves that benefit this player or harm opponents.
 */
import { ClientBehavior } from './index';
/**
 * AggressiveBehavior picks the action with highest estimated impact.
 *
 * Strategy:
 * 1. Avoid 'pass' or 'end_turn' actions
 * 2. Prefer actions that modify state (not just observers)
 * 3. If multiple options, pick the last one (convention: usually highest value)
 */
export declare class AggressiveBehavior implements ClientBehavior {
    chooseAction(state: unknown, playerId: string): unknown;
    private getActionName;
}
//# sourceMappingURL=aggressive.d.ts.map