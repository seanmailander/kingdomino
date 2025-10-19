import { Scenes, type ValidScenes } from "./scenes";

const hintsByScene = {
  [Scenes.Splash]: "Press any key to start",
  [Scenes.Lobby]: "Waiting for players",
  [Scenes.Game]: "Game",
  [Scenes.Shuffle]: "Shuffling",
  [Scenes.Scoring]: "",
};

type GetHintArgs = {
  scene: ValidScenes;
  hasEnoughPlayers: boolean;
  isMyTurn: boolean;
};

export const getHint = ({ scene, hasEnoughPlayers, isMyTurn }: GetHintArgs) => {
  if (scene === Scenes.Lobby) {
    // Check how many we are waiting for
    if (hasEnoughPlayers) {
      return "Players connected, hit 'ready' to start game";
    }
  }

  if (scene === Scenes.Game) {
    // Whose turn is it?
    if (isMyTurn) {
      return "Pick your card";
    } else {
      return "Waiting for Player 2 to pick their card";
    }
  }
  return hintsByScene[scene];
};
