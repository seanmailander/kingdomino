import express from "express";
import bodyParser from "body-parser";
import { ExpressPeerServer } from "peer";

import mdnsLib from "multicast-dns";
import os from "os";

const mdns = mdnsLib({ loopback: true });
const app = express();

app.use(bodyParser.json());
app.set("port", process.env.PORT || 3001);

// Express only serves static assets in production
if (process.env.NODE_ENV === "production") {
  console.debug("Serving static files from client/build");
  app.use(express.static("../client/build"));
}

type Lobby = {
  [playerId: string]: {
    waiting: boolean;
  };
};
const waitingPlayers: Lobby = {};
// Player A is new, gets added to waiting list with an id
// Player B is new, gets matched to A, gets A's id
// Player A is existing, was matched with B, waits for B to reach out

app.post("/api/letMeIn", (req, res) => {
  const { playerId } = req.body;

  // Player has not been seen before
  // Find any other players already waiting
  const otherPlayerIds = Object.keys(waitingPlayers).filter(
    (k) => k !== playerId,
  );
  if (otherPlayerIds.length === 0) {
    // No other players waiting
    const thisPlayerInWaitLine = Object.keys(waitingPlayers).filter(
      (k) => k === playerId,
    );
    // Just add them to the waiting list
    waitingPlayers[playerId] = { waiting: false };
    console.debug(`Player: ${playerId} joined as first in line`);
    res.json({ checkBackInMs: 1000 });
    return;
  }

  // We have at least two distinct players
  // Set the first two up in the same lobby
  const otherPlayerId = otherPlayerIds[0];

  console.debug(
    `Player: ${playerId} is joining ${otherPlayerId} in game lobby`,
  );
  // TODO: when do these get cleared?
  waitingPlayers[playerId] = {
    waiting: true,
  };

  if (waitingPlayers[otherPlayerId].waiting) {
    console.debug(
      "Both are connected, purging them from lobby",
      playerId,
      otherPlayerId,
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
  console.log(
    `See current peers at: http://localhost:${app.get(
      "port",
    )}/api/peers/default/peers`,
  );
});

const peerServer = ExpressPeerServer(server, {
  key: "default", // TODO: do we need different rooms per lobby?
  allow_discovery: true,
});

// Host this peer server on a fixed route
app.use("/api/peers", peerServer);

// Expose https://kingdomino.local on the local network
// TODO: let the user configure which interface to listen on
const defaultInterface = () => {
  const networks = os.networkInterfaces();
  const networksWithIPv4 = Object.keys(networks)
    .map((name) => Object.values(networks[name] ?? {}))
    .filter((network) =>
      network.some(({ family, internal }) => family === "IPv4" && !internal),
    );

  const firstNetwork = networksWithIPv4.pop();
  if (!firstNetwork) {
    return {
      ipv4: "127.0.0.1",
      ipv6: "::1",
    };
  }

  const v4Addresses = firstNetwork.filter(({ family }) => family === "IPv4");
  const v6Addresses = firstNetwork.filter(({ family }) => family === "IPv6");

  return {
    ipv4: v4Addresses[0].address,
    ipv6: v6Addresses[0].address,
  };
};

const interfaceToListenOn = defaultInterface();
mdns.on("query", function (query, rinfo) {
  if (query.questions.some(({ name }) => name === "kingdomino.local")) {
    // TODO: use subnet of rinfo to find matching address ???
    mdns.respond({
      answers: [
        {
          name: "kingdomino.local",
          type: "A",
          ttl: 300,
          data: interfaceToListenOn.ipv4,
        },
      ],
      additionals: [
        {
          name: "kingdomino.local",
          type: "A",
          ttl: 300,
          class: "IN",
          data: interfaceToListenOn.ipv4,
        },
        {
          name: "kingdomino.local",
          type: "AAAA",
          ttl: 300,
          class: "IN",
          data: interfaceToListenOn.ipv6,
        },
      ],
    });
  }
});
