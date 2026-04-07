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

See [research](./RESEARCH.md) for more info

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

# TODO

## IMMEDIATE

### Simplify DevX

- couch coop (local second player uses right-hand board, no WebRTC needed)
- e2e tests over local UI

- create a workflow for game state testing
  - reload game state
  - admin panel to select state

- make an e2e test for multiplayer that simulates two parallel browsers
- plan for reusable test scaffolds for the game (like the page fixture model) that can be invoked from e2e or integration or unit tests

## NOW

1. Add mid-game debug states

## NEXT

1. Display card value via crown overlay
4. Visual hint for card picked by other player, should not be pickable
5. Lobby to pick game style (ai, remote, couch) and player count (2,3,4)
6. Extract GameSession as an externalizable package, with a strict API surface (command, query, observe) and limited dependencies
  - players (local, remote, couch, ai) would not be included
  - transports (local, remote) would not be included
  - produce a flow diagram (mermaid) of game states, based upon commands + events

## NIRVANA

1. End the game when players lose connectivity
2. Show lobby of players waiting for a game
3. Better graphics for cards and crowns
4. Instructions on how to play as the game unfolds
5. Better graphics for splash screen
6. Support "Ready" to start game
7. Show shuffling animation and remaining deck
8. Let players pick their color
9. Tile display for 4 players
10. Hint at whose turn is coming up this round
11. Hint at whose turn is coming up next round
12. Automatically zoom board to fit
13. Add how the score was calculated to score board
14. Make it usable on a handheld form-factor
15. Make it deployable
