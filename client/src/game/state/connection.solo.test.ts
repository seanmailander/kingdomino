import { describe, expect, it } from "vitest";
import { SoloConnection } from "./connection.solo";
import { RandomAIPlayer } from "./ai.player";
import { MOVE, PAUSE_ACK, RESUME_ACK, revealMessage } from "./game.messages";
import { pauseRequestMessage, resumeRequestMessage } from "./game.messages";

const makeAiPlayer = () => {
  const ai = new RandomAIPlayer("them", "me");
  // Start game so generateMove() is callable (them picks first by convention)
  ai.startGame(["them", "me"]);
  return ai;
};

describe("SoloConnection control messages", () => {
  it("responds to PAUSE_REQUEST with PAUSE_ACK", async () => {
    const conn = new SoloConnection(makeAiPlayer());
    const ack = conn.waitFor(PAUSE_ACK);
    conn.send(pauseRequestMessage());
    await expect(ack).resolves.toBeUndefined();
  });

  it("responds to RESUME_REQUEST with RESUME_ACK", async () => {
    const conn = new SoloConnection(makeAiPlayer());
    const ack = conn.waitFor(RESUME_ACK);
    conn.send(resumeRequestMessage());
    await expect(ack).resolves.toBeUndefined();
  });
});

describe("SoloConnection — emitOpponentMove delegates to RandomAIPlayer", () => {
  it("emits a MOVE message with a valid card from the deal after REVEAL", async () => {
    const ai = new RandomAIPlayer("them", "me");
    ai.startGame(["them", "me"]); // AI picks first
    ai.beginRound([4, 22, 28, 46]);

    const conn = new SoloConnection(ai);
    const move = conn.waitFor(MOVE);

    // Trigger the REVEAL → emitOpponentMove chain
    conn.send(revealMessage("test-secret"));

    const payload = await move;
    expect([4, 22, 28, 46]).toContain(payload.move.card);
    expect(payload.move.playerId).toBe("them");
    expect(payload.move.x !== 0 || payload.move.y !== 0).toBe(true);
  });
});
