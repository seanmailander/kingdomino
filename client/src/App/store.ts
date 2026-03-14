import { configureStore } from "@reduxjs/toolkit";
import logger from "redux-logger";
import createSagaMiddleware from "redux-saga";

import reducer from "./reducer";
import saga from "./saga";

const devTools = import.meta.env.DEV;
const sagaMiddleware = createSagaMiddleware();

const configureAppStore = (preloadedState) => {
  const store = configureStore({
    reducer,
    middleware: (getDefaultMiddleware) => [
      ...getDefaultMiddleware({ thunk: false }),
      sagaMiddleware,
      logger,
    ],
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

  sagaMiddleware.run(saga);

  return store;
};

export default configureAppStore;
