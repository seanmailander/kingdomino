import { configureStore } from "@reduxjs/toolkit";
import logger from "redux-logger";
import createSagaMiddleware from "redux-saga";

import reducer from "./reducer";
import saga from "./saga";

const devTools = process.env.NODE_ENV !== "production";
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

  if (process.env.NODE_ENV !== "production" && module.hot) {
    module.hot.accept("./reducer", () => store.replaceReducer(reducer));
  }

  sagaMiddleware.run(saga);

  return store;
};

export default configureAppStore;
