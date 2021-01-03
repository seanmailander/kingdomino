import seedrandom from "seedrandom";

import newPeerConnection from "./peerConnection";
import {
  RESET_CONNECTIONS,
  INITIALIZE_GAME,
  SHUFFLE_DECK,
  CONNECTION_ERROR,
} from "./stateMachine";

const COMMITTMENT = "COMMITTMENT";
const REVEAL = "REVEAL";
const MOVE = "MOVE";

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

const buildTrustedSeed = async (sendGameMessage, onCommit, onReveal) => {
  const { secret: mySecret, committment: myCommittment } = await commit();
  await sendGameMessage({
    type: COMMITTMENT,
    content: { committment: myCommittment },
  });

  const {
    value: { committment: theirCommittment },
  } = await onCommit.next();

  await sendGameMessage({ type: REVEAL, content: { secret: mySecret } });

  const {
    value: { secret: theirSecret },
  } = await onReveal.next();

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

const initializeGame = ({ sendGameMessage, waitForGameMessage }) => {
  const onMove = waitForGameMessage(MOVE);
  const onCommit = waitForGameMessage(COMMITTMENT);
  const onReveal = waitForGameMessage(REVEAL);

  const trustedDeal = async (currentDeck) => {
    const trustedSeed = await buildTrustedSeed(
      sendGameMessage,
      onCommit,
      onReveal
    );
    console.debug("GAME:SEEDED", trustedSeed);

    const { next, remaining } = getNextFourCards(trustedSeed, currentDeck);
    console.debug("GAME:DEAL", next);
    return { next, remaining };
  };

  const makeMove = () => {
    console.debug("GAME:MOVE");
    sendGameMessage("MOVE", { move: "1,2,3,4" });
  };

  return {
    trustedDeal,
    makeMove,
  };
};

const newGame = (transition) => {
  let waitForPeerConnection;
  let game;
  let remainingDeck = undefined;

  const resetConnections = () => {
    transition(RESET_CONNECTIONS);
    console.debug("GAME:RESET new peer connections");
    waitForPeerConnection = newPeerConnection({
      onError: () => transition(CONNECTION_ERROR),
    });
  };

  const resetGame = async () => {
    if (!waitForPeerConnection) {
      resetConnections();
    }
    console.debug("GAME:RESET new game");
    const { sendGameMessage, waitForGameMessage } = await waitForPeerConnection;
    transition(INITIALIZE_GAME);
    console.debug("GAME:CONNECTED to peer");
    game = initializeGame({ sendGameMessage, waitForGameMessage });
    transition(SHUFFLE_DECK);
    trustedDeal();
  };

  const trustedDeal = async () => {
    const { next, remaining } = await game.trustedDeal(remainingDeck);
    console.debug(next, remainingDeck, remaining);
    return next;
  };

  resetGame();

  return {
    resetConnections,
    resetGame,
    trustedDeal,
  };
};

export default newGame;
