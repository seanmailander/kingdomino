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
export declare function createRng(seed: number): () => number;
//# sourceMappingURL=seed.d.ts.map