import { describe, it, expect } from "vitest";
import { ChaChaRng, BLOCK_WORDS, BUFFER_NUM_BLOCKS, BUFFER_WORDS } from "./index";

describe("ChaChaRng", () => {
  it("construction via fromSeed and fromRng", () => {
    const seed = new Uint8Array([
      0, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 2, 0, 0, 0, 0, 0, 0,
      0, 3, 0, 0, 0, 0, 0, 0, 0,
    ]);
    const rng1 = ChaChaRng.fromSeed(seed, 20);
    expect(rng1.next_u32()).toBe(137206642);

    const rng2 = ChaChaRng.fromRng(rng1, 20);
    expect(rng2.next_u32()).toBe(1325750369);
  });

  it("true values A — all-zero seed, first 32 words", () => {
    const rng = ChaChaRng.fromSeed(new Uint8Array(32).fill(0), 20);

    const results1 = new Uint32Array(16);
    for (let i = 0; i < 16; i++) results1[i] = rng.next_u32();
    expect(results1).toEqual(
      new Uint32Array([
        0xade0b876, 0x903df1a0, 0xe56a5d40, 0x28bd8653, 0xb819d2bd,
        0x1aed8da0, 0xccef36a8, 0xc70d778b, 0x7c5941da, 0x8d485751,
        0x3fe02477, 0x374ad8b8, 0xf4b8436a, 0x1ca11815, 0x69b687c3,
        0x8665eeb2,
      ]),
    );

    const results2 = new Uint32Array(16);
    for (let i = 0; i < 16; i++) results2[i] = rng.next_u32();
    expect(results2).toEqual(
      new Uint32Array([
        0xbee7079f, 0x7a385155, 0x7c97ba98, 0x0d082d73, 0xa0290fcb,
        0x6965e348, 0x3e53c612, 0xed7aee32, 0x7621b729, 0x434ee69c,
        0xb03371d5, 0xd539d874, 0x281fed31, 0x45fb0a51, 0x1f0ae1ac,
        0x6f4d794b,
      ]),
    );
  });

  it("true values B — seed with last byte=1, second block", () => {
    const seed = new Uint8Array(32).fill(0);
    seed[31] = 1;
    const rng = ChaChaRng.fromSeed(seed, 20);
    for (let i = 0; i < 16; i++) rng.next_u32(); // skip block 0

    const results = new Uint32Array(16);
    for (let i = 0; i < 16; i++) results[i] = rng.next_u32();
    expect(results).toEqual(
      new Uint32Array([
        0x2452eb3a, 0x9249f8ec, 0x8d829d9b, 0xddd4ceb1, 0xe8252083,
        0x60818b01, 0xf38422b8, 0x5aaa49c9, 0xbb00ca8e, 0xda3ba7b4,
        0xc4b592d1, 0xfdf2732f, 0x4436274e, 0x2561b3c8, 0xebdd4aa6,
        0xa0136c00,
      ]),
    );
  });

  it("true values C — seek with getWordPos / setWordPos / fillBytes", () => {
    const seed = new Uint8Array(32).fill(0);
    seed[1] = 0xff;

    const expectedBlock2 = new Uint32Array([
      0xfb4dd572, 0x4bc42ef1, 0xdf922636, 0x327f1394, 0xa78dea8f, 0x5e269039,
      0xa1bebbc1, 0xcaf09aae, 0xa25ab213, 0x48a6b46c, 0x1b9d9bcb, 0x092c5be6,
      0x546ca624, 0x1bec45d5, 0x87f47473, 0x96f0992e,
    ]);
    const expectedEndWordPos = BigInt(3 * BLOCK_WORDS);

    // Sequential read
    const rng1 = ChaChaRng.fromSeed(seed, 20);
    for (let i = 0; i < 32; i++) rng1.next_u32(); // skip blocks 0 & 1
    const results1 = new Uint32Array(16);
    for (let i = 0; i < 16; i++) results1[i] = rng1.next_u32();
    expect(results1).toEqual(expectedBlock2);
    expect(rng1.getWordPos()).toBe(expectedEndWordPos);

    // Seek with setWordPos
    const rng2 = ChaChaRng.fromSeed(seed, 20);
    rng2.setWordPos(BigInt(2 * BLOCK_WORDS));
    const results2 = new Uint32Array(16);
    for (let i = 0; i < 16; i++) results2[i] = rng2.next_u32();
    expect(results2).toEqual(expectedBlock2);
    expect(rng2.getWordPos()).toBe(expectedEndWordPos);

    // fillBytes word-position tracking
    const buf = new Uint8Array(32);
    rng2.fillBytes(buf); // 32 bytes = 8 words
    expect(rng2.getWordPos()).toBe(expectedEndWordPos + 8n);

    rng2.fillBytes(buf.subarray(0, 25)); // 25 bytes = ceil(25/4)=7 words
    expect(rng2.getWordPos()).toBe(expectedEndWordPos + 15n);

    rng2.next_u64(); // 2 words
    expect(rng2.getWordPos()).toBe(expectedEndWordPos + 17n);

    rng2.next_u32(); // 1 word
    rng2.next_u64(); // 2 words
    expect(rng2.getWordPos()).toBe(expectedEndWordPos + 20n);

    rng2.fillBytes(buf.subarray(0, 1)); // 1 byte = 1 word
    expect(rng2.getWordPos()).toBe(expectedEndWordPos + 21n);
  });

  it("multiple blocks — stride sampling across blocks", () => {
    const seed = new Uint8Array([
      0, 0, 0, 0, 1, 0, 0, 0, 2, 0, 0, 0, 3, 0, 0, 0, 4, 0, 0, 0, 5, 0, 0,
      0, 6, 0, 0, 0, 7, 0, 0, 0,
    ]);
    const rng = ChaChaRng.fromSeed(seed, 20);
    const results = new Uint32Array(16);
    for (let i = 0; i < 16; i++) {
      results[i] = rng.next_u32();
      for (let j = 0; j < 16; j++) rng.next_u32(); // skip 16 words
    }
    expect(results).toEqual(
      new Uint32Array([
        0xf225c81a, 0x6ab1be57, 0x04d42951, 0x70858036, 0x49884684,
        0x64efec72, 0x4be2d186, 0x3615b384, 0x11cfa18e, 0xd3c50049,
        0x75c775f6, 0x434c6530, 0x2c5bad8f, 0x898881dc, 0x5f1c86d9,
        0xc1f8e7f4,
      ]),
    );
  });

  it("true bytes — fillBytes output matches known vector", () => {
    const rng = ChaChaRng.fromSeed(new Uint8Array(32).fill(0), 20);
    const results = new Uint8Array(32);
    rng.fillBytes(results);
    expect(results).toEqual(
      new Uint8Array([
        118, 184, 224, 173, 160, 241, 61, 144, 64, 93, 106, 229, 83, 134, 189,
        40, 189, 210, 25, 184, 160, 141, 237, 26, 168, 54, 239, 204, 139, 119,
        13, 199,
      ]),
    );
  });

  it("nonce / stream — RFC 7539 test vector", () => {
    const rng = ChaChaRng.fromSeed(new Uint8Array(32).fill(0), 20);
    rng.setStream(2n << 56n); // 0x0200000000000000n

    const results = new Uint32Array(16);
    for (let i = 0; i < 16; i++) results[i] = rng.next_u32();
    expect(results).toEqual(
      new Uint32Array([
        0x374dc6c2, 0x3736d58c, 0xb904e24a, 0xcd3f93ef, 0x88228b1a,
        0x96a4dfb3, 0x5b76ab72, 0xc727ee54, 0x0e0e978a, 0xf3145c95,
        0x1b748ea8, 0xf786c297, 0x99c28f5f, 0x628314e8, 0x398a19fa,
        0x6ded1b53,
      ]),
    );
  });

  it("clone — clone tracks original, then diverges on setStream, then resyncs", () => {
    const seed = new Uint8Array([
      0, 0, 0, 0, 1, 0, 0, 0, 2, 0, 0, 0, 3, 0, 0, 0, 4, 0, 0, 0, 5, 0, 0,
      0, 6, 0, 0, 0, 7, 0, 0, 0,
    ]);
    const rng = ChaChaRng.fromSeed(seed, 20);
    const clone = rng.clone();

    for (let i = 0; i < 16; i++) {
      expect(rng.next_u64()).toBe(clone.next_u64());
    }

    rng.setStream(51n);
    for (let i = 0; i < 7; i++) {
      expect(rng.next_u32()).not.toBe(clone.next_u32());
    }

    clone.setStream(51n);
    for (let i = 7; i < 16; i++) {
      expect(rng.next_u32()).toBe(clone.next_u32());
    }
  });

  describe("word position helpers", () => {
    function runWordPosTests(rounds: number, label: string) {
      it(`${label} — initial pos 0, setWordPos(0) reproducible`, () => {
        const rng = ChaChaRng.fromSeed(new Uint8Array(32).fill(0), rounds);
        expect(rng.getWordPos()).toBe(0n);

        rng.setWordPos(0n);
        expect(rng.getWordPos()).toBe(0n);

        const val1 = rng.next_u32();
        rng.setWordPos(0n);
        expect(rng.next_u32()).toBe(val1);
      });

      it(`${label} — wrap exact (2^68 - bufWords)`, () => {
        const rng = ChaChaRng.fromSeed(new Uint8Array(32).fill(0), rounds);
        const wrapExactPos = (1n << 68n) - BigInt(BUFFER_WORDS);
        rng.setWordPos(wrapExactPos);
        expect(rng.getWordPos()).toBe(wrapExactPos);
        const val = rng.next_u32();

        rng.setWordPos(wrapExactPos);
        expect(rng.next_u32()).toBe(val);
      });

      it(`${label} — wrap excess (2^68 - blockWords) differs from wrap exact`, () => {
        const rng = ChaChaRng.fromSeed(new Uint8Array(32).fill(0), rounds);
        const wrapExactPos = (1n << 68n) - BigInt(BUFFER_WORDS);
        const wrapExcessPos = (1n << 68n) - BigInt(BLOCK_WORDS);

        rng.setWordPos(wrapExactPos);
        const valExact = rng.next_u32();

        rng.setWordPos(wrapExcessPos);
        expect(rng.getWordPos()).toBe(wrapExcessPos);
        const valExcess = rng.next_u32();

        expect(valExcess).not.toBe(valExact);
      });
    }

    runWordPosTests(20, "ChaCha20");
    runWordPosTests(12, "ChaCha12");
    runWordPosTests(8, "ChaCha8");
  });
});
