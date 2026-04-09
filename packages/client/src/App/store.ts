import { computed, effect } from "alien-signals";
import { useEffect, useMemo, useState } from "react";

import { useGameStore } from "./GameStoreContext";
import { computeHint } from "./AppExtras";

export { useGameStore } from "./GameStoreContext";
export { GameStoreProvider } from "./GameStoreContext";

/**
 * Single composite hook for App.tsx. Re-renders on any game event or room change.
 * Returns the live session (or null before the game starts) and the current room.
 */
export const useApp = () => {
  const store = useGameStore();
  const versionComputed = useMemo(() => computed(() => store.version()), [store]);
  const [, setVersion] = useState(() => versionComputed());

  useEffect(() => {
    return effect(() => {
      const v = versionComputed();
      setVersion((prev) => (prev === v ? prev : v));
    });
  }, [versionComputed]);

  const session = store.getSession();
  const room = store.getRoom();
  const hint = computeHint(session, room);

  return { session, room, hint };
};
