# Testing Plan

Covers the `logic/` and `state/` layers only. No visual or rendering concerns.  
Tests are written in domain language: nouns are game entities (deck, card, deal, round, board, kingdom, score), verbs are commands (`pick`, `place`, `discard`) and queries (`isValidPlacement`, `score`, `currentActor`).

---

## 1. Deck

| # | Scenario |
|---|----------|
| 1.1 | A fresh deck contains exactly 48 cards |
| 1.2 | Every card has two tiles; each tile has a terrain and a crown value |
| 1.3 | Dealing with the same seed produces the same four cards |
| 1.4 | Dealing with different seeds produces different four cards |
| 1.5 | A dealt hand excludes cards already drawn from the deck |

---

## 2. Card Placement (Logic)

| # | Scenario |
|---|----------|
| 2.1 | A fresh kingdom accepts a card in any of the four directions adjacent to the castle |
| 2.2 | A card placed touching a matching terrain is valid |
| 2.3 | A card placed touching only non-matching terrain is invalid |
| 2.4 | A card placed adjacent to the castle is always valid regardless of terrain |
| 2.5 | A card placed out of bounds (kingdom exceeds 5×5) is invalid |
| 2.6 | A card placed on an occupied cell is invalid |
| 2.7 | `eligiblePositions` returns only valid starting cells for a given card |
| 2.8 | `validDirections` for a cell returns only orientations that keep the card in bounds and connected |

---

## 3. Scoring (Logic)

| # | Scenario |
|---|----------|
| 3.1 | An empty kingdom scores zero |
| 3.2 | A single terrain region with no crowns scores zero |
| 3.3 | A single terrain region scores (region size × crown count) |
| 3.4 | Two disconnected terrain regions score independently and sum |
| 3.5 | Crowns in one region do not affect the score of an adjacent different-terrain region |

---

## 4. Deal

| # | Scenario |
|---|----------|
| 4.1 | Deal slots are sorted by card id ascending after construction |
| 4.2 | A player can `pick` an unclaimed card |
| 4.3 | Picking an already-claimed card throws |
| 4.4 | `nextRoundPickOrder` lists players in ascending slot (card id) order of their picks |

---

## 5. Round

| # | Scenario |
|---|----------|
| 5.1 | A new round starts in the `picking` phase with the first player as `currentActor` |
| 5.2 | After a player `picks`, the round enters the `placing` phase for that same player |
| 5.3 | After a player `places`, the round returns to `picking` for the next player |
| 5.4 | After all players have picked and placed, the round reaches `complete` |
| 5.5 | Picking out of turn throws |
| 5.6 | Placing during the `picking` phase throws |
| 5.7 | Placing an invalid move throws |

---

## 6. GameSession — Turn Flow

| # | Scenario |
|---|----------|
| 6.1 | `isMyTurn` is true for the local player at the start of a round |
| 6.2 | `isMyTurn` is false and `isMyPlace` is true after the local player picks |
| 6.3 | `localCardToPlace` returns the card id the local player picked |
| 6.4 | After the local player places, it becomes the next player's turn |

---

## 7. GameSession — Events

| # | Scenario |
|---|----------|
| 7.1 | `pick:made` fires with the correct card id when the local player picks |
| 7.2 | `place:made` fires with the correct placement when the local player places |
| 7.3 | `round:complete` fires once after all players finish their pick and place |
| 7.4 | `game:ended` fires after the final round completes |

---

## 8. GameSession — Full Round

| # | Scenario |
|---|----------|
| 8.1 | Completing a round accumulates one placement on each player's board |
| 8.2 | `currentRound` is null after a round completes |
| 8.3 | Scores after a completed round reflect placed tiles and crowns |
| 8.4 | Pick order in the next round follows the card-id ordering of the previous round's picks |

---

## 9. End of Game

| # | Scenario |
|---|----------|
| 9.1 | A session with no cards remaining cannot begin another round |
| 9.2 | Final scores are computed per player from all accumulated placements |
| 9.3 | The player with the highest score is the winner |
