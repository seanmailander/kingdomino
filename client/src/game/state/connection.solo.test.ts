import { describe, expect, it } from "vitest";
import { SoloConnection } from "./connection.solo";
import { PAUSE_ACK, RESUME_ACK } from "./game.messages";
import { pauseRequestMessage, resumeRequestMessage } from "./game.messages";

describe("SoloConnection control messages", () => {
  it("responds to PAUSE_REQUEST with PAUSE_ACK", async () => {
    const conn = new SoloConnection();
    const ack = conn.waitFor(PAUSE_ACK);
    conn.send(pauseRequestMessage());
    await expect(ack).resolves.toBeUndefined();
  });

  it("responds to RESUME_REQUEST with RESUME_ACK", async () => {
    const conn = new SoloConnection();
    const ack = conn.waitFor(RESUME_ACK);
    conn.send(resumeRequestMessage());
    await expect(ack).resolves.toBeUndefined();
  });
});
