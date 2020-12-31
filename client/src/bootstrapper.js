import React, { useEffect } from "react";

// Example POST method implementation:
async function getData(url = "", data = {}) {
  // Default options are marked with *
  const response = await fetch(url, {
    method: "GET", // *GET, POST, PUT, DELETE, etc.
    mode: "cors", // no-cors, *cors, same-origin
    cache: "no-cache", // *default, no-cache, reload, force-cache, only-if-cached
    credentials: "same-origin", // include, *same-origin, omit
    headers: {
      "Content-Type": "application/json",
      // 'Content-Type': 'application/x-www-form-urlencoded',
    },
    redirect: "follow", // manual, *follow, error
    referrerPolicy: "no-referrer", // no-referrer, *no-referrer-when-downgrade, origin, origin-when-cross-origin, same-origin, strict-origin, strict-origin-when-cross-origin, unsafe-url
  });
  return response.json(); // parses JSON response into native JavaScript objects
}

// Example POST method implementation:
async function postData(url = "", data = {}) {
  // Default options are marked with *
  const response = await fetch(url, {
    method: "POST", // *GET, POST, PUT, DELETE, etc.
    mode: "cors", // no-cors, *cors, same-origin
    cache: "no-cache", // *default, no-cache, reload, force-cache, only-if-cached
    credentials: "same-origin", // include, *same-origin, omit
    headers: {
      "Content-Type": "application/json",
      // 'Content-Type': 'application/x-www-form-urlencoded',
    },
    redirect: "follow", // manual, *follow, error
    referrerPolicy: "no-referrer", // no-referrer, *no-referrer-when-downgrade, origin, origin-when-cross-origin, same-origin, strict-origin, strict-origin-when-cross-origin, unsafe-url
    body: JSON.stringify(data), // body data type must match "Content-Type" header
  });
  return response.json(); // parses JSON response into native JavaScript objects
}
// eslint-disable-next-line no-restricted-globals
const IS_INITIATOR = location.hash === "#1";
console.debug("Is initiator:", IS_INITIATOR);

const newPeerConnection = () => {
  // eslint-disable-next-line no-undef
  const p = new SimplePeer({
    initiator: IS_INITIATOR,
    trickle: false,
    config: { iceServers: [] },
  });

  p.on("error", (err) => console.log("error", err));

  p.on("signal", async (data) => {
    console.debug("SIGNAL", data);

    if (data.type === "offer") {
      await postData("/api/bootstrap/startGame", data);
    }
    if (data.type === "answer") {
      await postData("/api/bootstrap/joinGame", data);
    }
  });

  p.on("connect", () => {
    console.log("CONNECT");
    p.send("whatever" + Math.random());
  });

  p.on("data", (data) => {
    console.log("data: " + data);
  });
  return p;
};

let p; //newPeerConnection();

const startGame = async () => {
  const { offer, answer } = await getData("/api/bootstrap/currentGame");
  if (IS_INITIATOR) {
    if (!offer || !p) {
      // no offer or no record of that peer connection
      // so start a new game
      console.debug("Starting a new game as initiator");
      p = newPeerConnection();
      setTimeout(startGame, 1000);
      return;
    }
    // Initiator has already sent an offer
    // Wait for an answer
    // TODO: Poll for this
    if (answer) {
      p?.signal(answer);
    } else {
      console.debug("Initiator is waiting for an answer");
      setTimeout(startGame, 1000);
    }
  } else {
    if (!p) {
      // Make a peer connection if we dont have one
      p = newPeerConnection();
    }
    // Non-initiator needs to see an offer
    // And when it sees one, proces and send an answer
    // TODO: poll for this
    if (offer) {
      p?.signal(offer);
    }
  }
};

function Bootstrapper() {
  useEffect(() => {
    startGame();
  }, []);

  return (
    <div className="App">
      <form>
        <textarea id="incoming"></textarea>
        <button type="submit">submit</button>
      </form>
      <pre id="outgoing"></pre>
    </div>
  );
}

export default Bootstrapper;
