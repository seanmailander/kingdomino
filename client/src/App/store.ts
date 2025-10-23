import { configureStore } from "@reduxjs/toolkit";
import logger from "redux-logger";
import createSagaMiddleware from "redux-saga";

import reducer, { RootState } from "./reducer";

const devTools = process.env.NODE_ENV !== "production";
const sagaMiddleware = createSagaMiddleware();

const configureAppStore = (preloadedState?: RootState) => {
  const store = configureStore({
    reducer,
    middleware: (getDefaultMiddleware) =>
      getDefaultMiddleware({ thunk: false }).concat([sagaMiddleware, logger]),
    preloadedState,
    devTools,
  });

  // @ts-expect-error hot is injected
  if (process.env.NODE_ENV !== "production" && module.hot) {
    // @ts-expect-error hot is injected
    module.hot.accept("./reducer", () => store.replaceReducer(reducer));
  }

  return store;
};

export default configureAppStore;
