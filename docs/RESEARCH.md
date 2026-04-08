# Research and thoughts

## Fair play between clients

[Provably fair](https://courses.csail.mit.edu/6.857/2019/project/2-Cen-Fang-Jaba.pdf)

[Untrusted](https://crypto.stackexchange.com/questions/767/how-to-fairly-select-a-random-number-for-a-game-without-trusting-a-third-party)

https://blog.codinghorror.com/shuffling/

### How will it work?

- A chooses a random number Ra
- A calculates hash Ha = H(Ra)
- A shares committment Ha
- B chooses a random number Rb
- B calculates hash Hb = H(Rb)
- B shares committment Hb
- Both A and B reveal Ra and Rb
- Both A and B verify committments
- Both A and B calculate shared random as G = H (Ra || Rb)

- 128 cards, each is unique (some repeats?)
- canonical identification (sort)
- game seed becomes seed of randomizer used to allocate guid to each card
- sort by per-card guid to get sorted deck (therefore, deck sorted by seed)

- both A and B calculate sorted deck

- each 4-draw, recommit and re-shuffle
  - important to re-randomize every turn, or future knowledge will help mis-behaving clients

## Setting up a game

- one instance with a server doing mdns for "kingdomino.local"
- exposes launchpad on HTTP
- client A opens "kingdomino.local", bootstraps into swarm
- client B opens "kingdomino.local", bootstraps into swarm
- clients set up new game adn start negotiations

- webRTC as transport

https://hpbn.co/webrtc/#partially-reliable-delivery-and-message-size

https://github.com/feross/simple-peer

https://github.com/JustGoscha/simple-datachannel/blob/master/static/index.html

## How it will really work

A well-known discovery mechanism

1.  a central server for discovery platform-agnostic (kingdomino.somepublicdomain.com)
2.  platform-provided discovery (Apple Game / Steam)
3.  one bootstrapper on local wifi (mDNS via native app)
4.  one bootstrapper on wan (NAT FQDN)

For now, go with 1. for simplicity (browser app)

two (later, four) players can join game

- Player A: launch kingdomino.somepublicdomain.com, start new game

- Player B: launch kingdomino.somepublicdomain.com, join existing game

serve static SPA, `/api/bootstrap/currentGame` for current game bootstrapping

- Player A: submit an offering to bootstrapper
- Player B: take the offer, submit an answer
- Player A: process answer, we now have a data channel

### Running server as an app

React Native + native implementation of server

### Runnign client in a browser

Debugging on iOS

https://jonsadka.com/blog/how-to-debug-a-chrome-specific-bug-on-ios-using-remote-debugging
