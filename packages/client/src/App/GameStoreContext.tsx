import React, { createContext, useContext, useEffect, useMemo } from "react";
import type { ReactNode } from "react";
import { GameStore } from "./GameStore";

const GameStoreContext = createContext<GameStore | null>(null);

export function GameStoreProvider({
  children,
  store,
}: {
  children: ReactNode;
  store?: GameStore;
}) {
  const ownedStore = useMemo(() => store ?? new GameStore(), [store]);

  useEffect(() => {
    return () => ownedStore.dispose();
  }, [ownedStore]);

  return (
    <GameStoreContext.Provider value={ownedStore}>
      {children}
    </GameStoreContext.Provider>
  );
}

export const useGameStore = (): GameStore => {
  const store = useContext(GameStoreContext);
  if (!store) {
    throw new Error("useGameStore must be used within a GameStoreProvider");
  }
  return store;
};
