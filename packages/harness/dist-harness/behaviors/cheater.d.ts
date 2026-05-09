/**
 * Cheater behavior — deliberately attempts illegal actions.
 *
 * Used to test that the game correctly rejects invalid moves and
 * returns structured error responses with reason codes.
 */
import { ClientBehavior } from './index';
/**
 * CheaterBehavior attempts an action that is NOT in the legal actions set.
 *
 * Returns a synthetic "illegal" action that should be rejected by the game.
 * This validates that the game's move validation is working correctly.
 */
export declare class CheaterBehavior implements ClientBehavior {
    chooseAction(): unknown;
}
//# sourceMappingURL=cheater.d.ts.map