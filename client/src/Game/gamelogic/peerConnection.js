import { EventIterator } from "event-iterator";

import { hashIt } from "./utils";

const INITIATED_EVENT = "INITIATED";

export const newPeerConnection = (isInitiator) =>
  // eslint-disable-next-line no-undef
  new SimplePeer({
    initiator: isInitiator,
    trickle: false,
    config: { iceServers: [] },
  });

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
        yield message;
      }
    }
  };
};
const oneMessageAtATime = (peerFinder) => (messageType) => {
  const observable = subscribeToGameMessage(peerFinder)(messageType);
  return observable[Symbol.asyncIterator]();
};

const waitToGetMyOfferIn = async (p) =>
  new Promise((resolve, reject) => {
    p.once(INITIATED_EVENT, () => {
      resolve();
    });
  });

export const getPeerIdentifiers = async (p) => {
  const myIdentifier = await hashIt(JSON.stringify(p._pc.localDescription));
  const theirIdentifier = await hashIt(JSON.stringify(p._pc.remoteDescription));
  return {
    me: myIdentifier,
    them: theirIdentifier,
  };
};
// const newPeerConnection2 = async ({ onError }) => {
// const initialPeerFinder = newPeerfinder(true, onError, playerId);

// await waitToGetMyOfferIn(initialPeerFinder);
// // Start the chain
// const connectedPeer = await checkBackIn(0, playerId, p);

//   await waitForConnection(connectedPeer);

//   const waitForGameMessage = oneMessageAtATime(connectedPeer);

//   const sendGameMessage = ({ type, content }) => {
//     const message = {
//       type,
//       ...content,
//     };
//     connectedPeer.send(JSON.stringify(message));
//   };
//   // TODO: add reset of some kind
//   // or timeout?

//   const myIdentifier = await hashIt(
//     JSON.stringify(connectedPeer._pc.localDescription)
//   );
//   const theirIdentifier = await hashIt(
//     JSON.stringify(connectedPeer._pc.remoteDescription)
//   );
//   const peerIdentifiers = {
//     me: myIdentifier,
//     them: theirIdentifier,
//   };

//   // TODO: support graceful closing from peer

//   const destroy = () => connectedPeer.destroy();

//   return {
//     peerIdentifiers,
//     sendGameMessage,
//     waitForGameMessage,
//     destroy,
//   };
// };
