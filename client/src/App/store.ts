import { computed, effect, signal } from "alien-signals";
import { useEffect, useMemo, useState } from "react";

import reducer from "./reducer";
import type { RootState } from "./reducer";
import type { GameAction } from "../game/game.actions";

export type GameStore = {
  state: {
    (): RootState;
    (value: RootState): void;
  };
  emit: (action: GameAction) => void;
};

const configureAppStore = (preloadedState?: RootState): GameStore => {
  let currentState = reducer(preloadedState, { type: "@@init" });
  const state = signal(currentState);
  const action = signal<GameAction | undefined>(undefined);

  effect(() => {
    const nextAction = action();

    if (!nextAction) {
      return;
    }

    currentState = reducer(currentState, nextAction);
    state(currentState);
  });

  return {
    state,
    emit: (nextAction) => {
      action(nextAction);
    },
  };
};

export const gameStore = configureAppStore();

export const emitGameAction = (action: GameAction) => gameStore.emit(action);

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

export const selectComputed = <TSelected>(selector: (state: RootState) => TSelected) =>
  computed(() => selector(gameStore.state()));

export const useGameSelector = <TSelected>(selector: (state: RootState) => TSelected): TSelected => {
  const selectedSignal = useMemo(() => selectComputed(selector), [selector]);
  const [selected, setSelected] = useState(() => selectedSignal());

  useEffect(() => {
    return effect(() => {
      const next = selectedSignal();
      setSelected((previous) => (Object.is(previous, next) ? previous : next));
    });
  }, [selectedSignal]);

  return selected;
};

export default configureAppStore;
