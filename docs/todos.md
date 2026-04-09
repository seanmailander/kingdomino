# Todos

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

1. Split pick from move — both are independent player actions; decouple in game state and connection interface
2. Normalize `notifyLocalDiscard` into the standard send/waitFor message pipeline (remove special-case handling)
3. Add mid-game debug states

## NEXT

1. Display card value via crown overlay
2. Visual hint for card picked by other player, should not be pickable
3. Lobby to pick game style (ai, remote, couch) and player count (2,3,4)
4. Extract GameSession as an externalizable package, with a strict API surface (command, query, observe) and limited dependencies
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
