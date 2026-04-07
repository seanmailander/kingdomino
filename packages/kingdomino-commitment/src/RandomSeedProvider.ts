import type { SeedProvider } from "kingdomino-engine";

export class RandomSeedProvider implements SeedProvider {
  private readonly _fixed?: string;

  constructor(options: { fixed?: string } = {}) {
    this._fixed = options.fixed;
  }

  async nextSeed(): Promise<string> {
    if (this._fixed !== undefined) return this._fixed;
    const arr = new Uint8Array(32);
    crypto.getRandomValues(arr);
    return Array.from(arr).map(b => b.toString(16).padStart(2, "0")).join("");
  }
}
