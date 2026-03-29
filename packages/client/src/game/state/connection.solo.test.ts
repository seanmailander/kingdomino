import { describe, expect, it } from "vitest";
import { SoloConnection } from "./connection.solo";
import { RandomAIPlayer } from "./ai.player";
import { PICK, PLACE, PAUSE_ACK, RESUME_ACK } from "./game.messages";
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
    await expect(ack).resolves.toMatchObject({ type: "CONTROL_PAUSE_ACK" });
  });

  it("responds to RESUME_REQUEST with RESUME_ACK", async () => {
    const conn = new SoloConnection(makeAiPlayer());
    const ack = conn.waitFor(RESUME_ACK);
    conn.send(resumeRequestMessage());
    await expect(ack).resolves.toMatchObject({ type: "CONTROL_RESUME_ACK" });
  });
});

describe("SoloConnection — notifyRoundStarted delegates to RandomAIPlayer", () => {
  it("emits PICK and PLACE messages with a valid card from the deal when AI acts first", async () => {
    const ai = new RandomAIPlayer("them", "me");
    ai.startGame(["them", "me"]); // AI picks first
    ai.beginRound([4, 22, 28, 46]);

    const conn = new SoloConnection(ai);
    const pickPromise = conn.waitFor(PICK);
    const placePromise = conn.waitFor(PLACE);

    // Trigger the AI's first move after round has started
    conn.notifyRoundStarted();

    const pick = await pickPromise;
    expect([4, 22, 28, 46]).toContain(pick.cardId);
    expect(pick.playerId).toBe("them");

    const place = await placePromise;
    expect(place.playerId).toBe("them");
    expect(place.x !== 0 || place.y !== 0).toBe(true);
  });
});
