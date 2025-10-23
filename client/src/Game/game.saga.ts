import { call, put, take, takeLatest } from "redux-saga/effects";
import {
  gameStarted,
  orderChosen,
  playerJoined,
  gameEnded,
  startSolo,
} from "./game.actions";

import { chooseOrderFromSeed } from "./gamelogic/utils";

import newSoloConnection from "./connection.solo.saga";
import roundSaga from "./round.saga";
import { buildTrustedSeed, COMMITTMENT, REVEAL, MOVE } from "./game.messages";
import { PeerIdentifiers } from "./types";
import { useDispatch } from "react-redux";
import { addListener, createListenerMiddleware } from "@reduxjs/toolkit";

const useChooseOrder = (
  peerIdentifiers: PeerIdentifiers,
  sendGameMessage,
  waitForGameMessage,
) => {
  const dispatch = useDispatch();

  // Get a shared seed so its random who goes first
  const firstSeed = buildTrustedSeed(sendGameMessage, waitForGameMessage);

  // Now use that seed to sort the peer identifiers
  const choosenOrder = chooseOrderFromSeed(firstSeed, peerIdentifiers);
  dispatch(orderChosen(choosenOrder));
};

const useNewGame = async (
  peerIdentifiers: PeerIdentifiers,
  sendGameMessage,
  waitForGameMessage,
) => {
  const dispatch = useDispatch();
  // Work out who goes first
  useChooseOrder(peerIdentifiers, sendGameMessage, waitForGameMessage);

  // const onMove = yield call(waitForGameMessage, MOVE);
  // const onCommit = yield call(waitForGameMessage, COMMITTMENT);
  // const onReveal = yield call(waitForGameMessage, REVEAL);

  // First round!
  let remainingDeck = roundSaga(sendGameMessage);
  // Subsequent rounds
  while (remainingDeck.length > 0) {
    remainingDeck = roundSaga(sendGameMessage, remainingDeck);
  }

  dispatch(gameEnded());
};

export const listenerMiddleware = createListenerMiddleware();

export const useSoloGame = async () => {
  const dispatch = useDispatch();
  const { destroy, peerIdentifiers, sendGameMessage, waitForGameMessage } =
    await newSoloConnection();

  dispatch(playerJoined({ playerId: peerIdentifiers.me, isMe: true }));
  dispatch(playerJoined({ playerId: peerIdentifiers.them, isMe: false }));

  // When the first player starts the game, send it to other players
  const unsubscribe = dispatch(
    addListener({ predicate: () => gameStarted, effect: () => {} }),
  );

  return useNewGame(peerIdentifiers, sendGameMessage, waitForGameMessage);
};
