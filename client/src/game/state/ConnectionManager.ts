import {
  MOVE,
  PAUSE_REQUEST,
  PAUSE_ACK,
  RESUME_REQUEST,
  RESUME_ACK,
  EXIT_REQUEST,
  EXIT_ACK,
  moveMessage,
  startMessage,
  pauseRequestMessage,
  pauseAckMessage,
  resumeRequestMessage,
  resumeAckMessage,
  exitRequestMessage,
  exitAckMessage,
  type GameMessage,
  type GameMessagePayload,
  type GameMessageType,
  type PlayerMoveMessage,
} from "./game.messages";

type WaitForGameMessage = <T extends GameMessageType>(
  messageType: T,
) => Promise<GameMessagePayload<T>>;
type SendGameMessage = (message: GameMessage) => void;

export class ConnectionManager {
  private readonly sendGameMessage: SendGameMessage;
  private readonly waitForGameMessage: WaitForGameMessage;

  constructor(
    sendGameMessage: SendGameMessage,
    waitForGameMessage: WaitForGameMessage,
  ) {
    this.sendGameMessage = sendGameMessage;
    this.waitForGameMessage = waitForGameMessage;
  }

  sendStart() {
    this.sendGameMessage(startMessage());
  }

  sendMove(move: PlayerMoveMessage) {
    this.sendGameMessage(moveMessage(move));
  }

  waitForMove() {
    return this.waitForGameMessage(MOVE);
  }

  sendPauseRequest() { this.sendGameMessage(pauseRequestMessage()); }
  sendPauseAck()     { this.sendGameMessage(pauseAckMessage()); }
  sendResumeRequest() { this.sendGameMessage(resumeRequestMessage()); }
  sendResumeAck()    { this.sendGameMessage(resumeAckMessage()); }
  sendExitRequest()  { this.sendGameMessage(exitRequestMessage()); }
  sendExitAck()      { this.sendGameMessage(exitAckMessage()); }

  waitForPauseAck(timeoutMs: number)   { return this.waitForWithTimeout(PAUSE_ACK, timeoutMs); }
  waitForPauseRequest()                { return this.waitForGameMessage(PAUSE_REQUEST); }
  waitForResumeAck(timeoutMs: number)  { return this.waitForWithTimeout(RESUME_ACK, timeoutMs); }
  waitForResumeRequest()               { return this.waitForGameMessage(RESUME_REQUEST); }
  waitForExitAck(timeoutMs: number)    { return this.waitForWithTimeout(EXIT_ACK, timeoutMs); }
  waitForExitRequest()                 { return this.waitForGameMessage(EXIT_REQUEST); }

  private waitForWithTimeout<T extends GameMessageType>(
    messageType: T,
    timeoutMs: number,
  ): Promise<GameMessagePayload<T>> {
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        reject(new Error(`Timeout waiting for ${messageType}`));
      }, timeoutMs);
      this.waitForGameMessage(messageType).then(
        (payload) => { clearTimeout(timer); resolve(payload); },
        (err) => { clearTimeout(timer); reject(err); },
      );
    });
  }
}
