import "react";

type Props = {
  onGameStart: () => void;
};

export function SplashComponent({ onGameStart }: Props) {
  return (
    <>
      <h1>Kingdomino</h1>
      <h5>Press any key to start</h5>
      <button aria-label="Join lobby" onClick={onGameStart}>
        Ready for a game with friends?
      </button>
      <button aria-label="Start solo" onClick={onGameStart}>
        Ready for a game on your own?
      </button>
    </>
  );
}
