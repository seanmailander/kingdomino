/**
 * Client behavior interface and registry.
 *
 * Each behavior determines how a player chooses actions in the game.
 * The agent can use different behaviors for different players to test
 * various game scenarios.
 */
import { ScriptedBehavior } from './scripted';
import { RandomBehavior } from './random';
import { PassiveBehavior } from './passive';
import { AggressiveBehavior } from './aggressive';
import { CheaterBehavior } from './cheater';
/**
 * Resolve a behavior spec into a concrete behavior implementation.
 *
 * @param spec - Behavior specification
 * @returns Instantiated behavior
 * @throws Error if spec is invalid or unsupported
 */
export function resolveBehavior(spec) {
    if (typeof spec === 'object' && spec !== null) {
        const s = spec;
        switch (s.behavior) {
            case 'scripted':
                return new ScriptedBehavior(s.script);
            case 'random':
                return new RandomBehavior();
            case 'passive':
                return new PassiveBehavior();
            case 'aggressive':
                return new AggressiveBehavior();
            case 'cheater':
                return new CheaterBehavior();
            default:
                throw new Error(`Unknown behavior: ${s.behavior}`);
        }
    }
    throw new Error('Invalid behavior spec');
}
//# sourceMappingURL=index.js.map