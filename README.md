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

# TODO

## NOW

2. Calculate only eligible places by open spaces
3. Restrict player to play on eligible spaces
4. Calculate only eligible places by neighbors
5. Calculate only eligible places by board size

## NEXT

1. Display card value via crown overlay
2. Provide a score at end of game
3. Prompt to play again at end of game

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
15. Support https://kingdomino.local/ discovery
