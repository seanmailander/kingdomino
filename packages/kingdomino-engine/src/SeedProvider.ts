/**
 * Provides seeds for cryptographically fair card distribution.
 * Implementations: CommitmentSeedProvider (P2P), RandomSeedProvider (solo/test).
 *
 * Note: `nextSeed()` returns `Promise<string>` (hex string).
 */
export interface SeedProvider {
  nextSeed(): Promise<string>;
}
