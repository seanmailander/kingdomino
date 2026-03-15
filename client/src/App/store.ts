import { configureStore } from "@reduxjs/toolkit";
import logger from "redux-logger";

import reducer from "./reducer";
import type { RootState } from "./reducer";

const devTools = import.meta.env.DEV;

const configureAppStore = (preloadedState?: RootState) => {
  const store = configureStore({
    reducer,
    middleware: (getDefaultMiddleware) => getDefaultMiddleware().concat([logger]),
    preloadedState,
    devTools,
  });

  if (import.meta.hot) {
    import.meta.hot.accept("./reducer", (next) => {
      if (next?.default) {
        store.replaceReducer(next.default);
      }
    });
  }

  return store;
};

export default configureAppStore;
