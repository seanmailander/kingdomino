import { describe, it, expect } from "vitest";
import { CommitmentSeedProvider } from "./CommitmentSeedProvider";
import type { CommitmentTransport } from "./CommitmentTransport";

/** Simple in-process transport: A's sends → B's inbound, B's sends → A's inbound */
const makeLinkedPair = (): [CommitmentTransport, CommitmentTransport] => {
  type Resolver = (v: unknown) => void;

  const makeChannel = () => {
    const waiters = new Map<string, Resolver[]>();
    const queued  = new Map<string, unknown[]>();
    return {
      enqueue(type: string, msg: unknown) {
        const resolvers = waiters.get(type);
        if (resolvers?.length) {
          resolvers.shift()!(msg);
        } else {
          if (!queued.has(type)) queued.set(type, []);
          queued.get(type)!.push(msg);
        }
      },
      waitFor<T>(type: string): Promise<T> {
        const q = queued.get(type);
        if (q?.length) return Promise.resolve(q.shift() as T);
        return new Promise<T>((resolve) => {
          if (!waiters.has(type)) waiters.set(type, []);
          waiters.get(type)!.push(resolve as Resolver);
        });
      },
    };
  };

  const inboxB = makeChannel(); // A sends → B reads
  const inboxA = makeChannel(); // B sends → A reads

  const transportA: CommitmentTransport = {
    send(msg)           { inboxB.enqueue(msg.type, msg.content); },
    waitFor<T>(type: string)    { return inboxA.waitFor<T>(type); },
  };
  const transportB: CommitmentTransport = {
    send(msg)           { inboxA.enqueue(msg.type, msg.content); },
    waitFor<T>(type: string)    { return inboxB.waitFor<T>(type); },
  };

  return [transportA, transportB];
};

describe("CommitmentSeedProvider", () => {
  it("two peers with linked transports produce the same seed", async () => {
    const [transportA, transportB] = makeLinkedPair();
    const providerA = new CommitmentSeedProvider(transportA);
    const providerB = new CommitmentSeedProvider(transportB);

    const [seedA, seedB] = await Promise.all([
      providerA.nextSeed(),
      providerB.nextSeed(),
    ]);
    expect(seedA).toBe(seedB);
    expect(typeof seedA).toBe("string");
  });
});
