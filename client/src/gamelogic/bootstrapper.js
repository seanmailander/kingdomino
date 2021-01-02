import { getData, postData } from "./fetch";

// eslint-disable-next-line no-restricted-globals
const IS_INITIATOR = location.hash === "#1";
console.debug("Is initiator:", IS_INITIATOR);

const INITIATED_EVENT = "INITIATED";

const newPeerConnection = () => {
  // eslint-disable-next-line no-undef
  const p = new SimplePeer({
    initiator: IS_INITIATOR,
    trickle: false,
    config: { iceServers: [] },
  });

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
    // p.send("whatever" + Math.random());
  });

  // p.on("data", (data) => {
  //   console.debug("DATA:", data);
  // });

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

const bootstrapper = () => {
  const peerConnection = newPeerConnection();
  connectToOtherPlayers(peerConnection, waitForInitiation(peerConnection))();

  return {
    peerConnection,
    isInitiator: IS_INITIATOR,
  };
};

const singleton = bootstrapper();

export default singleton;
