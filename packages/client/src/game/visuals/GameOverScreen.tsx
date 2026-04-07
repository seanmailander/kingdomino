import type { ScoreEntry } from "kingdomino-engine";

import "./GameOverScreen.css";

export type { ScoreEntry };

export type GameOverScreenProps = {
  scores: ScoreEntry[];
  onReturnToLobby: () => void;
};

export function GameOverScreen({ scores, onReturnToLobby }: GameOverScreenProps) {
  if (scores.length === 0) {
    return (
      <div data-testid="game-over">
        <h2>Game over</h2>
        <p>No score data available.</p>
        <button onClick={onReturnToLobby}>Return to Lobby</button>
      </div>
    );
  }

  return (
    <div data-testid="game-over" className="game-over-screen">
      <h2>Game over</h2>
      <ol className="game-over-scores" aria-label="Final scores">
        {scores.map((entry) => {
          const baseScore = entry.score - entry.bonuses.middleKingdom - entry.bonuses.harmony;
          return (
            <li
              key={entry.player.id}
              className={entry.isWinner ? "score-entry score-entry--winner" : "score-entry"}
              aria-label={`${entry.player.id}${entry.isWinner ? " (winner)" : ""}`}
            >
              <span className="score-entry__name">
                {entry.isWinner && <span aria-hidden="true">🏆 </span>}
                {entry.player.id}
              </span>
              <dl className="score-entry__breakdown">
                <dt>Base score</dt>
                <dd>{baseScore}</dd>
                {entry.bonuses.middleKingdom > 0 && (
                  <>
                    <dt>Middle Kingdom</dt>
                    <dd>+{entry.bonuses.middleKingdom}</dd>
                  </>
                )}
                {entry.bonuses.harmony > 0 && (
                  <>
                    <dt>Harmony</dt>
                    <dd>+{entry.bonuses.harmony}</dd>
                  </>
                )}
                <dt>Total</dt>
                <dd>
                  <strong>{entry.score}</strong>
                </dd>
              </dl>
            </li>
          );
        })}
      </ol>
      <button className="game-over-screen__return-btn" onClick={onReturnToLobby}>
        Return to Lobby
      </button>
    </div>
  );
}
