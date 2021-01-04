import { getData, postData } from "./fetch";
import { EventIterator } from "event-iterator";

import { hashIt } from "./utils";

// eslint-disable-next-line no-restricted-globals
const IS_INITIATOR = location.hash === "#1";
console.debug("PEER:INITIALIZE Is initiator:", IS_INITIATOR);

const INITIATED_EVENT = "INITIATED";

const subscribeToGameMessages = (emitter) =>
  new EventIterator(
    ({ push }) => {
      const handleData = (data) => {
        push(JSON.parse(data));
      };
      //TODO: handle close, error, done, etc
      emitter.on("data", handleData);
      return () => emitter.off("data", handleData);
    },
    { highWaterMark: 5 }
  );

const subscribeToGameMessage = (emitter) => {
  const subscription = subscribeToGameMessages(emitter);
  return async function* (messageType) {
    for await (const message of subscription) {
      if (message.type === messageType) {
        console.debug("PEER:RECEIVE", messageType);
        yield message;
      }
    }
  };
};
const oneMessageAtATime = (peerFinder) => (messageType) => {
  const observable = subscribeToGameMessage(peerFinder)(messageType);
  return observable[Symbol.asyncIterator]();
};

const newPeerfinder = (isInitiator, onError) => {
  // TODO: is this an npm module?
  // eslint-disable-next-line no-undef
  const p = new SimplePeer({
    initiator: isInitiator,
    trickle: false,
    config: { iceServers: [] },
  });

  // TODO: bubble up errors
  p.on("error", (err) => console.error("ERROR", err));
  p.on("error", onError);

  p.on("signal", async (data) => {
    if (data.type === "offer") {
      await postData("/api/bootstrap/startGame", data);
      p.emit(INITIATED_EVENT);
    }
    if (data.type === "answer") {
      await postData("/api/bootstrap/joinGame", data);
    }
  });

  return p;
};

const waitForInitiation = async (p) => {
  if (!IS_INITIATOR) {
    return;
  }
  return new Promise((resolve, reject) => {
    p.once(INITIATED_EVENT, () => {
      resolve();
    });
  });
};

const waitForConnection = async (p) => {
  return new Promise((resolve, reject) => {
    p.once("connect", resolve);
  });
};

const connectToOtherPlayers = (p, asyncInitiation) => async () => {
  await asyncInitiation;
  const { offer, answer } = await getData("/api/bootstrap/currentGame");
  if (IS_INITIATOR) {
    if (!offer) {
      // no offer or no record of that peer connection
      // so start a new game
      console.debug("PEER:CONNECT Starting a new game as initiator");
      setTimeout(connectToOtherPlayers(p), 1000);
      return;
    }
    // Initiator has already sent an offer
    // Wait for an answer
    if (answer) {
      p?.signal(answer);
      return;
    }

    console.debug("PEER:CONNECT Initiator is waiting for an answer");
    setTimeout(connectToOtherPlayers(p), 1000);
  } else {
    // Non-initiator needs to see an offer
    // And when it sees one, proces and send an answer
    if (offer) {
      p?.signal(offer);
    } else {
      console.debug("PEER:CONNECT Non-Initiator is waiting for an offer");
      setTimeout(connectToOtherPlayers(p), 1000);
    }
  }
};

const newPeerConnection = async ({ onError }) => {
  const peerFinder = newPeerfinder(IS_INITIATOR, onError);
  connectToOtherPlayers(peerFinder, waitForInitiation(peerFinder))();

  await waitForConnection(peerFinder);

  const waitForGameMessage = oneMessageAtATime(peerFinder);

  const sendGameMessage = ({ type, content }) => {
    console.debug("PEER:SEND", type, content);
    const message = {
      type,
      ...content,
    };
    peerFinder.send(JSON.stringify(message));
  };
  // TODO: add reset of some kind
  // or timeout?

  const myIdentifier = await hashIt(JSON.stringify(peerFinder._pc.localDescription));
  const theirIdentifier = await hashIt(JSON.stringify(peerFinder._pc.remoteDescription));
  const peerIdentifiers = {
    me: myIdentifier,
    them: theirIdentifier,
  };

  console.debug(peerIdentifiers);

  return {
    peerIdentifiers,
    sendGameMessage,
    waitForGameMessage,
  };
};

export default newPeerConnection;
