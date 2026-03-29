/// <reference types="vite/client" />

declare module "seedrandom" {
  type SeedRandomGenerator = (() => number) & { int32: () => number };

  export default function seedrandom(seed?: string): SeedRandomGenerator;
}
