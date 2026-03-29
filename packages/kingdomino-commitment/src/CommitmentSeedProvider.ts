import { commit, verify, combine } from "kingdomino-engine";
import type { SeedProvider } from "kingdomino-engine";
import type { CommitmentTransport } from "./CommitmentTransport";

const randomHex = (): string => {
  const arr = new Uint8Array(32);
  crypto.getRandomValues(arr);
  return Array.from(arr).map(b => b.toString(16).padStart(2, "0")).join("");
};

export class CommitmentSeedProvider implements SeedProvider {
  constructor(private readonly transport: CommitmentTransport) {}

  async nextSeed(): Promise<string> {
    const mySecret = randomHex();
    const myCommittment = await commit(mySecret);
    this.transport.send({ type: "COMMITTMENT", content: { committment: myCommittment } });

    const { committment: theirCommittment } = await this.transport.waitFor<{ committment: string }>("COMMITTMENT");
    this.transport.send({ type: "REVEAL", content: { secret: mySecret } });

    const { secret: theirSecret } = await this.transport.waitFor<{ secret: string }>("REVEAL");
    const isValid = await verify(theirSecret, theirCommittment);
    if (!isValid) throw new Error("Remote commitment verification failed");

    return combine(mySecret, theirSecret);
  }
}
