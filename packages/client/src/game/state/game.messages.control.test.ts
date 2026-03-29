import { describe, expect, it } from "vitest";
import {
  PAUSE_REQUEST,
  PAUSE_ACK,
  RESUME_REQUEST,
  RESUME_ACK,
  EXIT_REQUEST,
  EXIT_ACK,
  pauseRequestMessage,
  pauseAckMessage,
  resumeRequestMessage,
  resumeAckMessage,
  exitRequestMessage,
  exitAckMessage,
} from "./game.messages";

describe("control game messages", () => {
  it("creates pause request message", () => {
    expect(pauseRequestMessage()).toEqual({ type: PAUSE_REQUEST });
  });

  it("creates pause ack message", () => {
    expect(pauseAckMessage()).toEqual({ type: PAUSE_ACK });
  });

  it("creates resume request message", () => {
    expect(resumeRequestMessage()).toEqual({ type: RESUME_REQUEST });
  });

  it("creates resume ack message", () => {
    expect(resumeAckMessage()).toEqual({ type: RESUME_ACK });
  });

  it("creates exit request message", () => {
    expect(exitRequestMessage()).toEqual({ type: EXIT_REQUEST });
  });

  it("creates exit ack message", () => {
    expect(exitAckMessage()).toEqual({ type: EXIT_ACK });
  });
});
