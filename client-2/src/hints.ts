const hintsByRoom = {
  [Splash]: "Press any key to start",
  [Lobby]: "Waiting for players",
  [Game]: "Game",
  [Shuffle]: "Shuffling",
  [Scoring]: "",
};
export const getHint = (room, hasEnoughPlayers, isMyTurn) => {
  if (room === Lobby) {
    // Check how many we are waiting for
    if (hasEnoughPlayers) {
      return "Players connected, hit 'ready' to start game";
    }
  }

  if (room === Game) {
    // Whose turn is it?
    if (isMyTurn) {
      return "Pick your card";
    } else {
      return "Waiting for Player 2 to pick their card";
    }
  }
  return hintsByRoom[room];
};
