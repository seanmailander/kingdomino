import type { Player } from "../state/Player";

export type GameEndedEntry = {
  player: Player;
  score: number;
  bonuses: { middleKingdom: number; harmony: number };
};

export type ScoreEntry = GameEndedEntry & { isWinner: boolean };

/**
 * Enriches a sorted scores array (from game:ended) with isWinner flags.
 * All players whose score, largestPropertySize, and totalCrowns equal
 * the top entry's values are marked as co-winners.
 */
export function determineWinners(scores: GameEndedEntry[]): ScoreEntry[] {
  if (scores.length === 0) return [];

  const top = scores[0];
  const topLargest = top.player.board.largestPropertySize();
  const topCrowns = top.player.board.totalCrowns();

  return scores.map((entry) => ({
    ...entry,
    isWinner:
      entry.score === top.score &&
      entry.player.board.largestPropertySize() === topLargest &&
      entry.player.board.totalCrowns() === topCrowns,
  }));
}
