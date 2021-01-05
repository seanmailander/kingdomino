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

const gameLobbies = [];

// Player A is new, gets added to waiting list with an offer
// Player B is new, gets matched to A, gets A's offer
// Player A is existing, was matched with B, waits for B's answer
// Player B is existing, was matched with A, shares an answer
// Player A is existing, was matched with B, gets B's answer

app.post("/api/bootstrap/letMeIn", (req, res) => {
  const { playerId, offer, answer } = req.body;

  // Find if this player is matched with another
  const matchedLobby = gameLobbies.find((lobby) =>
    Object.keys(lobby).some((p) => p === playerId)
  );
  if (matchedLobby) {
    // This player has been matched
    // What state are we in?
    const state = matchedLobby[playerId].state;

    console.debug(`Player: ${playerId} in lobby state: ${state}`);

    if (state === "waiting-for-answer") {
      // Who is the other player?
      const otherPlayerId = Object.keys(matchedLobby).find(
        (p) => p !== playerId
      );
      const { answer } = matchedLobby[otherPlayerId];
      if (answer) {
        // The other player has shared an answer
        // Share it with this player
        console.debug("Sharing an answer with ", playerId);
        matchedLobby[playerId] = {
          state: "waiting-for-acknowledge",
        };
        res.json({ answer });
        return;
      }
      // The other player has not shared an answer
      // Better wait a little longer
      res.json({ checkBackInMs: 5000 });
      return;
    }

    if (state === "needs-to-share-answer") {
      // This player needs to share an answer
      // Did they supply one
      if (answer) {
        // Store this answer to share with the other player
        matchedLobby[playerId] = {
          state: "waiting-for-acknowledge",
          answer,
        };
        res.json({ waitForConnection: true });
        return;
      }
      // No answer supplied
      // Give them some time to figure it out

      res.json({ checkBackInMs: 5000 });
      //TODO: abort the whole lobby?
      // res.status(400).json({ error: "You were supposed to share an answer" });
      return;
    }

    if (state === "waiting-for-acknowledge") {
      // Waiting for the other player to acknowledge
      // Nothing to do, just keep waiting
      res.json({ waitForConnection: true });
      return;
    }
  }

  console.debug(`Player: ${playerId} not in lobby`);

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
    // First time we've seen them?
    if (thisPlayerInWaitLine.length === 0) {
      // Just add them to the waiting list
      waitingPlayers[playerId] = {
        offer,
      };
      console.debug(`Player: ${playerId} joined as first in line`, offer);
      res.json({ checkBackInMs: 5000 });
      return;
    }

    // Already in line
    console.debug(`Player: ${playerId} is first in line`);

    res.json({ checkBackInMs: 5000 });
    return;
  }

  // We have at least two distinct players
  // Set the first two up in the same lobby
  const otherPlayerId = otherPlayerIds[0];
  const { offer: otherPlayerOffer } = waitingPlayers[otherPlayerId];

  console.debug(`Player: ${playerId} is joining ${otherPlayerId} in lobby`);

  const newLobby = {
    [playerId]: { state: "needs-to-share-answer" },
    [otherPlayerId]: { state: "waiting-for-answer" },
  };
  gameLobbies.push(newLobby);

  delete waitingPlayers[otherPlayerId];
  // TODO: timeout after 30seconds, force client to re-attempt
  res.json({ offer: otherPlayerOffer });
  console.debug("sent offer", otherPlayerOffer);
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
