const express = require("express");
const bodyParser = require("body-parser");
const { ExpressPeerServer } = require("peer");

const app = express();

app.use(bodyParser.json());
app.set("port", process.env.PORT || 3001);

// Express only serves static assets in production
if (process.env.NODE_ENV === "production") {
  app.use(express.static("client/build"));
}

const waitingPlayers = {};
// Player A is new, gets added to waiting list with an id
// Player B is new, gets matched to A, gets A's id
// Player A is existing, was matched with B, waits for B to reach out

app.post("/api/letMeIn", (req, res) => {
  const { playerId } = req.body;

  // Player has not been seen before
  // Find any other players already waiting
  const otherPlayerIds = Object.keys(waitingPlayers).filter(
    (k) => k !== playerId
  );
  if (otherPlayerIds.length === 0) {
    // No other players waiting
    const thisPlayerInWaitLine = Object.keys(waitingPlayers).filter(
      (k) => k === playerId
    );
    // Just add them to the waiting list
    waitingPlayers[playerId] = {};
    console.debug(`Player: ${playerId} joined as first in line`);
    res.json({ checkBackInMs: 5000 });
    return;
  }

  // We have at least two distinct players
  // Set the first two up in the same lobby
  const otherPlayerId = otherPlayerIds[0];

  console.debug(
    `Player: ${playerId} is joining ${otherPlayerId} in game lobby`
  );
  // TODO: when do these get cleared?
  waitingPlayers[playerId] = {
    waiting: true,
  };

  if (waitingPlayers[otherPlayerId].waiting) {
    console.debug(
      "Both are connected, purging them from lobby",
      playerId,
      otherPlayerId
    );
    delete waitingPlayers[playerId];
    delete waitingPlayers[otherPlayerId];
    return res.json({ waitForConnection: true });
  }

  // TODO: timeout after 30seconds, force client to re-attempt
  res.json({ otherPlayerId });
  return;
});

const server = app.listen(app.get("port"), () => {
  console.log(`Find the server at: http://localhost:${app.get("port")}/`);
});

const peerServer = ExpressPeerServer(server, {
  key: "default", // TODO: do we need different rooms per lobby?
  allow_discovery: true,
});

// Host this peer server on a fixed route
app.use("/api/peers", peerServer);
