import { all, call, spawn } from "redux-saga/effects";

import game from "../Game/game.saga";

// single entry point to start all Sagas at once
export default function* rootSaga() {
  const sagas = [game];

  yield all(
    sagas.map((saga) =>
      spawn(function* () {
        while (true) {
          try {
            yield call(saga);
            break;
          } catch (e) {
            console.log(e);
          }
        }
      })
    )
  );
}
