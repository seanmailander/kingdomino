// States that may occur
export const Splash = "Splash" as const;
export const Lobby = "Lobby" as const;
export const Game = "Game" as const;
export const Shuffle = "Shuffle" as const;
export const Scoring = "Scoring" as const;

export const Scenes = {
  [Splash]: Splash,
  [Lobby]: Lobby,
  [Game]: Game,
  [Shuffle]: Shuffle,
  [Scoring]: Scoring,
};


export type ValidScenes = keyof typeof Scenes;