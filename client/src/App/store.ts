import { computed, effect, signal } from "alien-signals";
import { useEffect, useMemo, useState } from "react";

import { App, type AppSelectorState, type AppState } from "./App";
import type { GameAction } from "../game/state/types";

const appState = signal<AppState>(App.initialState());

export const getAppState = (): AppState => appState();

export const emitGameAction = (action: GameAction) => {
  appState(App.appReducer(appState(), action));
};

export const createGameSignal = <TPayload>(actionCreator: (payload: TPayload) => GameAction) => {
  return (payload: TPayload) => {
    emitGameAction(actionCreator(payload));
  };
};

export const createGameSignalNoPayload = (actionCreator: () => GameAction) => {
  return () => {
    emitGameAction(actionCreator());
  };
};

export function useGameSignal(actionCreator: () => GameAction): () => void;
export function useGameSignal<TPayload>(
  actionCreator: (payload: TPayload) => GameAction<TPayload>,
): (payload: TPayload) => void;
export function useGameSignal<TPayload>(actionCreator: (payload?: TPayload) => GameAction) {
  return (payload?: TPayload) => {
    emitGameAction(actionCreator(payload));
  };
}

export const selectComputed = <TSelected>(selector: (state: AppSelectorState) => TSelected) =>
  computed(() => selector({ app: appState() }));

export const useApp = (): App => {
  const appSignal = useMemo(() => computed(() => App.fromState(appState())), []);
  const [app, setApp] = useState(() => appSignal());

  useEffect(() => {
    return effect(() => {
      const next = appSignal();
      setApp((previous) => (Object.is(previous, next) ? previous : next));
    });
  }, [appSignal]);

  return app;
};
