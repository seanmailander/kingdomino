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
 * In-memory snapshot store.
 * Maps snapshot IDs to cloned game states.
 */
const snapshotStore = new Map<string, unknown>()

/**
 * Counter for snapshot ID generation.
 */
let nextSnapshotId = 0

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
export function snapshot(state: unknown): string {
  const id = String(nextSnapshotId++)
  // Deep clone to prevent future mutations from affecting the snapshot
  snapshotStore.set(id, structuredClone(state))
  return id
}

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
export function restore(snapshotId: string): unknown {
  const stored = snapshotStore.get(snapshotId)
  if (stored === undefined) {
    throw new Error(`Snapshot not found: ${snapshotId}`)
  }
  // Deep clone to prevent mutations from affecting the stored snapshot
  return structuredClone(stored)
}

/**
 * Clear all snapshots. Useful for testing or between sessions.
 */
export function clearSnapshots(): void {
  snapshotStore.clear()
  nextSnapshotId = 0
}
