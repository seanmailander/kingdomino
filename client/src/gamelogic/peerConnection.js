import { getData, postData } from "./fetch";
import { EventIterator } from "event-iterator";

// eslint-disable-next-line no-restricted-globals
const IS_INITIATOR = location.hash === "#1";
console.debug("Is initiator:", IS_INITIATOR);

const INITIATED_EVENT = "INITIATED";

const subscribeToGameMessages = (emitter) =>
  new EventIterator(
    ({ push }) => {
      const handleData = (data) => {
        console.debug("saw data for handler", JSON.parse(data));
        push(JSON.parse(data));
      };
      // JANKY manual first-message presumed to be ate by initator
      push({ type: "INITALIZED" });
      //TODO: handle close, error, done, etc
      emitter.on("data", handleData);
      return () => emitter.off("data", handleData);
    },
    { highWaterMark: 2 }
  );

const subscribeToGameMessage = (emitter) => {
  console.debug("here it is");
  const subscription = subscribeToGameMessages(emitter);
  return async function* (messageType) {
    console.debug("new subscriber: ", messageType);
    for await (const message of subscription) {
      console.debug("PEER:RECEIVE", messageType, message.type);
      if (message.type === messageType) {
        yield message;
      }
    }
  };
};
const oneMessageAtATime = (peerFinder) => (messageType) => {
  const observable = subscribeToGameMessage(peerFinder)(messageType);
  const iterator = observable[Symbol.asyncIterator]();
  // force the first subscription, throw it away
  // iterator.next().then((data) => {
  //   console.debug("saw first result", messageType, data);
  // });
  return iterator;
};

const newPeerfinder = (isInitiator) => {
  // TODO: is this an npm module?
  // eslint-disable-next-line no-undef
  const p = new SimplePeer({
    initiator: isInitiator,
    trickle: false,
    config: { iceServers: [] },
  });

  // TODO: bubble up errors
  p.on("error", (err) => console.error("ERROR", err));

  p.on("signal", async (data) => {
    console.debug("SIGNAL", data);

    if (data.type === "offer") {
      await postData("/api/bootstrap/startGame", data);
      p.emit(INITIATED_EVENT);
    }
    if (data.type === "answer") {
      await postData("/api/bootstrap/joinGame", data);
    }
  });

  p.on("connect", () => {
    console.debug("CONNECTED to game peer");
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
      console.debug("Starting a new game as initiator");
      setTimeout(connectToOtherPlayers(p), 1000);
      return;
    }
    // Initiator has already sent an offer
    // Wait for an answer
    if (answer) {
      p?.signal(answer);
      return;
    }

    console.debug("Initiator is waiting for an answer");
    setTimeout(connectToOtherPlayers(p), 1000);
  } else {
    // Non-initiator needs to see an offer
    // And when it sees one, proces and send an answer
    if (offer) {
      p?.signal(offer);
    } else {
      console.debug("Non-Initiator is waiting for an offer");
      setTimeout(connectToOtherPlayers(p), 1000);
    }
  }
};

const newPeerConnection = async () => {
  const peerFinder = newPeerfinder(IS_INITIATOR);
  connectToOtherPlayers(peerFinder, waitForInitiation(peerFinder))();

  await waitForConnection(peerFinder);

  console.debug("Connected to peer");

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

  return {
    sendGameMessage,
    waitForGameMessage,
  };
};

export default newPeerConnection;
