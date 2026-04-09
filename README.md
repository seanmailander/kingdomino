# kingdomino

Recreate the [Kingdomino board game](https://en.wikipedia.org/wiki/Kingdomino) by Bruno Cathala

With a twist!

- game lobbies are for discovery of players only
- play is entirely peer-to-peer
- works on local networks without internet connectivity

These (arbitrary) constraints force the use of technologies like:

- [WebRTC](https://webrtc.org/)
- [mDNS](https://en.wikipedia.org/wiki/Multicast_DNS)
- [Committment scheme](https://en.wikipedia.org/wiki/Commitment_scheme)

See [research](./docs/RESEARCH.md) for more info

# Current state

- Client app loads in the browser
- Basic progression from lobby to game and back
- Connectivity is bare-bones, but works
- Deck is shuffled in a "fair" way
- Players can pick cards and take turns making moves
- Full game loop: pause, resume, and exit controls synchronized across peers
- Solo play with a RandomAI opponent (no WebRTC needed for single-player)
- Only eligible placement positions are offered (by neighbors, rotation, and board bounds)
- Unplaceable dominoes are automatically discarded
- Games are scored and winners are displayed
- Client-only development workflow: Vitest unit/integration tests + Storybook visual TDD
