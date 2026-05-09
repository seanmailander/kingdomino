/**
 * Random behavior — picks a random legal action.
 *
 * Uses the seeded RNG to ensure deterministic randomness.
 * Never attempts illegal moves.
 */
import { ClientBehavior } from './index';
/**
 * RandomBehavior picks randomly from the available legal actions.
 *
 * Requires the game state to have a getLegalActions() method.
 */
export declare class RandomBehavior implements ClientBehavior {
    chooseAction(state: unknown, playerId: string, rng: () => number): unknown;
}
//# sourceMappingURL=random.d.ts.map