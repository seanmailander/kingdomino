/**
 * Seeded pseudo-random number generator (PRNG).
 *
 * Provides deterministic, reproducible randomness seeded from a number.
 * Uses the mulberry32 algorithm for simplicity and quality.
 *
 * All randomness in the harness must use this, never Math.random().
 */
/**
 * Create a seeded PRNG.
 *
 * @param seed - Initial seed value (any 32-bit integer)
 * @returns A function that returns floats in [0, 1) with deterministic sequence
 *
 * @example
 * const rng = createRng(42);
 * const a = rng(); // always produces same value for seed 42
 * const b = rng(); // always produces same second value for seed 42
 */
export function createRng(seed) {
    let state = seed >>> 0; // ensure unsigned 32-bit integer
    return () => {
        // Mulberry32 algorithm
        let t = (state += 0x6d2b79f5);
        t = Math.imul(t ^ (t >>> 15), 1 | t);
        t ^= t + Math.imul(t ^ (t >>> 7), 61 | t);
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
}
//# sourceMappingURL=seed.js.map