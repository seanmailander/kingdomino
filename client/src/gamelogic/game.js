import seedrandom from "seedrandom";
import { EventIterator } from "event-iterator";

import bootstrapper from "./bootstrapper";

// Make a predictable pseudorandom number generator.
// https://stackoverflow.com/a/12646864
const seededShuffle = (seed) => {
  const seededRandom = seedrandom(seed);

  return (array) => {
    for (let i = array.length - 1; i > 0; i--) {
      const j = Math.floor(seededRandom() * (i + 1));
      [array[i], array[j]] = [array[j], array[i]];
    }
    return array;
  };
};

const hashIt = async (input) => {
  const encoder = new TextEncoder();
  const data = encoder.encode(input);
  const hash = await crypto.subtle.digest("SHA-1", data);
  const hashString = btoa(String.fromCharCode(...new Uint8Array(hash)));
  return hashString;
};

const commit = async () => {
  const randomNumber = seedrandom().int32();
  const hashString = await hashIt(randomNumber);

  return {
    secret: randomNumber,
    committment: hashString,
  };
};

const publishCommittment = async (peerConnection, committment) => {
  const message = {
    type: "COMMITTMENT",
    committment,
  };
  peerConnection.send(JSON.stringify(message));
};

const revealMyCommittment = async (peerConnection, secret) => {
  const message = {
    type: "REVEAL",
    secret,
  };
  peerConnection.send(JSON.stringify(message));
};

const verify = async (secret, committment) => {
  const hashString = await hashIt(secret);
  return committment === hashString;
};

const combine = async (a, b) => {
  const combinedRandom = a ^ b;
  return hashIt(combinedRandom);
};

// - A chooses a random number Ra
// - A calculates hash Ha = H(Ra)
// - A shares committment Ha
// - B chooses a random number Rb
// - B calculates hash Hb = H(Rb)
// - B shares committment Hb
// - Both A and B reveal Ra and Rb
// - Both A and B verify committments
// - Both A and B calculate shared random as G = H (Ra || Rb)

const buildTrustedSeed = async (
  peerConnection,
  committmentListener,
  revealListener
) => {
  const { secret: mySecret, committment: myCommittment } = await commit();
  await publishCommittment(peerConnection, myCommittment);

  const { committment: theirCommittment } = await committmentListener.next();

  await revealMyCommittment(peerConnection, mySecret);

  const { secret: theirSecret } = await revealListener.next();

  await verify(theirSecret, theirCommittment);

  return await combine(mySecret, theirSecret);
};

// - 128 cards, each is unique (some repeats?)
// - canonical identification (sort)
// - both A and B calculate sorted deck using shared seed

const deck = [1, 2, 3, 4, 5, 6, 7, 8, 9];
const getNextFourCards = (seed, remainingDeck = deck) => {
  const shuffledDeck = seededShuffle(seed)(remainingDeck.slice(0));
  const nextFour = shuffledDeck.slice(0, 4);
  const nextRemaining = shuffledDeck.slice(4);
  return {
    next: nextFour,
    remaining: nextRemaining,
  };
};

// - each 4-draw, recommit and re-shuffle
//   - important to re-randomize every turn, or future knowledge will help mis-behaving clients

const subscribeToGameMessage = (emitter, messageType) =>
  new EventIterator(({ push }) => {
    const handleData = (data) => {
      const message = JSON.parse(data);
      if (message.type === messageType) {
        push(message);
      }
    };
    //TODO: handle close, error, done, etc
    emitter.on("data", handleData);
    return () => emitter.off("data", handleData);
  });

const newGame = (peerConnection) => {
  peerConnection.on("error", (err) => console.error("GAME:ERROR", err));

  const committmentListener = subscribeToGameMessage(
    peerConnection,
    "COMMITTMENT"
  );
  const committmentIterator = committmentListener[Symbol.asyncIterator]();
  const revealListener = subscribeToGameMessage(peerConnection, "REVEAL");
  const revealIterator = revealListener[Symbol.asyncIterator]();

  peerConnection.on("data", (data) => {
    // console.debug("GAME:DATA:", data);
    console.debug("GAME:DATA", JSON.parse(data));
  });

  peerConnection.on("connect", async () => {
    console.debug("GAME:CONNECTED to game peer");
    const trustedSeed = await buildTrustedSeed(
      peerConnection,
      committmentIterator,
      revealIterator
    );
    console.debug("GAME:SEEDED", trustedSeed);

    const trustedSeed2 = await buildTrustedSeed(
      peerConnection,
      committmentIterator,
      revealIterator
    );
    console.debug("GAME:SEEDED_AGAIN", trustedSeed2);

    const { next, remaining } = getNextFourCards(trustedSeed);
    console.debug({ next, remaining });
    console.debug(getNextFourCards(trustedSeed2, remaining));
  });

  return {
    thing: "blah",
  };
};

const gameSingleton = () => {
  const game = newGame(bootstrapper.peerConnection);

  return {
    game,
  };
};

const singleton = gameSingleton();

export default singleton;
