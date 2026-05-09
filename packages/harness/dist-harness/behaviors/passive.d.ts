/**
 * Passive behavior — picks the legal action with lowest impact.
 *
 * Prefers safe, conservative moves over aggressive ones.
 * Useful for testing without interference from AI aggression.
 */
import { ClientBehavior } from './index';
/**
 * PassiveBehavior picks the action that minimizes impact or changes.
 *
 * Strategy:
 * 1. Look for a 'pass' or 'end_turn' action (lowest impact)
 * 2. Otherwise pick the first legal action (safest)
 */
export declare class PassiveBehavior implements ClientBehavior {
    chooseAction(state: unknown, playerId: string): unknown;
    private getActionName;
}
//# sourceMappingURL=passive.d.ts.map