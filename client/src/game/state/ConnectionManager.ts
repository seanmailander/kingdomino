import { commit, verify, combine } from "../gamelogic/utils";
import {
  COMMITTMENT,
  REVEAL,
  MOVE,
  committmentMessage,
  revealMessage,
  moveMessage,
  startMessage,
  type GameMessage,
  type GameMessagePayload,
  type GameMessageType,
  type PlayerMoveMessage,
} from "./game.messages";

type WaitForGameMessage = <T extends GameMessageType>(
  messageType: T,
) => Promise<GameMessagePayload<T>>;
type SendGameMessage = (message: GameMessage) => void;

type TrustedSeedHandshakeState =
  | "idle"
  | "local-commit-sent"
  | "remote-commit-received"
  | "local-reveal-sent"
  | "complete";

type TrustedSeedDependencies = {
  commit?: typeof commit;
  verify?: typeof verify;
  combine?: typeof combine;
};

export class ConnectionManager {
  private readonly sendGameMessage: SendGameMessage;
  private readonly waitForGameMessage: WaitForGameMessage;
  private readonly buildCommitment: typeof commit;
  private readonly verifyCommitment: typeof verify;
  private readonly combineSecrets: typeof combine;

  private trustedSeedState: TrustedSeedHandshakeState = "idle";

  constructor(
    sendGameMessage: SendGameMessage,
    waitForGameMessage: WaitForGameMessage,
    dependencies: TrustedSeedDependencies = {},
  ) {
    this.sendGameMessage = sendGameMessage;
    this.waitForGameMessage = waitForGameMessage;
    this.buildCommitment = dependencies.commit ?? commit;
    this.verifyCommitment = dependencies.verify ?? verify;
    this.combineSecrets = dependencies.combine ?? combine;
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

  // - A chooses a random number Ra
  // - A calculates hash Ha = H(Ra)
  // - A shares committment Ha
  // - B chooses a random number Rb
  // - B calculates hash Hb = H(Rb)
  // - B shares committment Hb
  // - Both A and B reveal Ra and Rb
  // - Both A and B verify committments
  // - Both A and B calculate shared random as G = H (Ra || Rb)

  async buildTrustedSeed() {
    this.assertHandshakeReady();

    console.debug("building trusted seed");
    const { secret: mySecret, committment: myCommittment } = await this.buildCommitment();
    this.sendCommittment(myCommittment);
    this.trustedSeedState = "local-commit-sent";

    const { committment: theirCommittment } = await this.waitForCommittment();
    this.trustedSeedState = "remote-commit-received";

    this.sendReveal(mySecret);
    this.trustedSeedState = "local-reveal-sent";

    const { secret: theirSecret } = await this.waitForReveal();

    const isValid = await this.verifyCommitment(theirSecret, theirCommittment);
    if (!isValid) {
      this.resetTrustedSeedHandshake();
      throw new Error("Remote committment verification failed");
    }

    const theirSecretAsNumber = Number(theirSecret);
    if (isNaN(theirSecretAsNumber)) {
      this.resetTrustedSeedHandshake();
      throw new Error("Their secret is not a valid number");
    }

    const trustedSeed = await this.combineSecrets(mySecret, theirSecretAsNumber);
    this.trustedSeedState = "complete";
    console.debug("done building trusted seed");
    return trustedSeed;
  }

  private sendCommittment(committment: string) {
    this.sendGameMessage(committmentMessage(committment));
  }

  private waitForCommittment() {
    return this.waitForGameMessage(COMMITTMENT);
  }

  private sendReveal(secret: string | number) {
    this.sendGameMessage(revealMessage(secret));
  }

  private async waitForReveal() {
    return this.waitForGameMessage(REVEAL);
  }

  private resetTrustedSeedHandshake() {
    this.trustedSeedState = "idle";
  }

  private assertHandshakeReady() {
    if (this.trustedSeedState === "complete") {
      this.resetTrustedSeedHandshake();
    }

    if (this.trustedSeedState !== "idle") {
      throw new Error(
        `buildTrustedSeed() can only start from idle state (current: ${this.trustedSeedState})`,
      );
    }
  }
}
