import { Scenes, type ValidScenes } from "./scenes";

const hintsByScene = {
  [Scenes.Game]: "Game",
  [Scenes.Shuffle]: "Shuffling",
  [Scenes.Scoring]: "",
};

type GetHintArgs = {
  scene: ValidScenes;
  isMyTurn: boolean;
};

export const getHint = ({ scene, isMyTurn }: GetHintArgs) => {
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
