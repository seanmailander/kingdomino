import { test } from "vitest";
import { getNextFourCards, hashIt } from "./src/gamelogic/utils";

test("find seeds dealing card 46", async () => {
  const results: Array<{ local: number; remote: number; deal: number[] }> = [];
  // Try small secret pairs
  for (let l = 1; l <= 50; l++) {
    for (let r = 100; r <= 200; r++) {
      const seed = await hashIt(l ^ r);
      const { next } = getNextFourCards(seed);
      const sorted = [...next].sort((a, b) => a - b);
      if (sorted.includes(46)) {
        results.push({ local: l, remote: r, deal: sorted });
        if (results.length >= 5) break;
      }
    }
    if (results.length >= 5) break;
  }
  console.log("Seeds dealing card 46:", JSON.stringify(results));
}, 30000);
