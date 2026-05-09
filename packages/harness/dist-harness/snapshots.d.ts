/**
 * Snapshot and restore game state.
 *
 * Provides in-memory checkpointing to test mid-game scenarios without
 * replaying from the beginning.
 *
 * All snapshots are deep-cloned using structuredClone to ensure
 * mutations don't affect stored state.
 */
/**
 * Take a snapshot of the current game state.
 *
 * @param state - The game state to snapshot (deep cloned)
 * @returns Snapshot ID string for later restoration
 *
 * @example
 * const id = snapshot(gameState);
 * // ... modify gameState ...
 * restore(id); // back to original
 */
export declare function snapshot(state: unknown): string;
/**
 * Restore a previously snapshotted game state.
 *
 * @param snapshotId - The ID returned from snapshot()
 * @returns A deep clone of the snapshotted state
 * @throws Error if snapshot ID not found
 *
 * @example
 * const id = snapshot(gameState);
 * const restoredState = restore(id);
 */
export declare function restore(snapshotId: string): unknown;
/**
 * Clear all snapshots. Useful for testing or between sessions.
 */
export declare function clearSnapshots(): void;
//# sourceMappingURL=snapshots.d.ts.map