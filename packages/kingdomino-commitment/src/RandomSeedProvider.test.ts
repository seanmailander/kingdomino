import { describe, it, expect } from "vitest";
import { RandomSeedProvider } from "./RandomSeedProvider";

describe("RandomSeedProvider", () => {
  it("returns a string from nextSeed()", async () => {
    const provider = new RandomSeedProvider();
    const seed = await provider.nextSeed();
    expect(typeof seed).toBe("string");
    expect(seed.length).toBeGreaterThan(0);
  });

  it("deterministic mode returns the same seed each time", async () => {
    const provider = new RandomSeedProvider({ fixed: "test-seed" });
    expect(await provider.nextSeed()).toBe("test-seed");
    expect(await provider.nextSeed()).toBe("test-seed");
  });
});
