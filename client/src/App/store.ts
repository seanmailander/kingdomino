import { useSyncExternalStore } from "react";

import reducer from "./reducer";
import type { RootState } from "./reducer";
import type { GameAction } from "../Game/game.actions";

type Listener = () => void;

export type GameStore = {
  getState: () => RootState;
  dispatch: (action: GameAction) => void;
  subscribe: (listener: Listener) => () => void;
};

const configureAppStore = (preloadedState?: RootState): GameStore => {
  let state = reducer(preloadedState, { type: "@@init" });
  const listeners = new Set<Listener>();

  return {
    getState: () => state,
    dispatch: (action) => {
      state = reducer(state, action);
      listeners.forEach((listener) => listener());
    },
    subscribe: (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
  };
};

export const gameStore = configureAppStore();

export const useGameDispatch = () => gameStore.dispatch;

export const useGameSelector = <TSelected>(selector: (state: RootState) => TSelected): TSelected =>
  useSyncExternalStore(gameStore.subscribe, () => selector(gameStore.getState()));

export default configureAppStore;
