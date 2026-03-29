// TypeScript port of ChaCha RNG from the rust-random project.
// Original: https://github.com/rust-random/rand/blob/0c955c5b7a079bc2fe67fe946a8deb46c4bc58d8/rand_chacha/src/chacha.rs
// Port performed by gemini-2.5-pro-preview-05-06 via https://gist.github.com/bakkot/4411d44df0d4bfdb50d7ec5ae3a9bd6a
//
// Licensed under the Apache License, Version 2.0 or MIT license, at your option.
// Copyright 2018 Developers of the Rand project.

export const BLOCK_WORDS = 16; // u32 words per ChaCha block
export const BUFFER_NUM_BLOCKS = 4; // ChaCha blocks in the buffer
export const BUFFER_WORDS = BLOCK_WORDS * BUFFER_NUM_BLOCKS; // 64 u32 words total

const MASK32 = 0xffffffffn;
const MASK64 = (1n << 64n) - 1n;
const MASK68_WORD_POS = (1n << 68n) - 1n;

function ROTL32(x: number, n: number): number {
  return ((x << n) | (x >>> (32 - n))) >>> 0;
}

class ChaChaCore {
  private state: Uint32Array;
  private seed: Uint8Array;
  private streamId: bigint;
  private blockCounter: bigint;
  private numDoubleRounds: number;

  // "expand 32-byte k"
  private static readonly CONSTANTS = new Uint32Array([
    0x61707865, 0x3320646e, 0x79622d32, 0x6b206574,
  ]);

  constructor(seed: Uint8Array, streamId: bigint, numDoubleRounds: number) {
    if (seed.length !== 32) {
      throw new Error("Seed must be 32 bytes long.");
    }
    this.seed = Uint8Array.from(seed);
    this.streamId = streamId & MASK64;
    this.blockCounter = 0n;
    this.numDoubleRounds = numDoubleRounds;
    this.state = new Uint32Array(16);
  }

  private quarterRound(
    x: Uint32Array,
    a: number,
    b: number,
    c: number,
    d: number,
  ): void {
    x[a] = (x[a] + x[b]) >>> 0;
    x[d] = ROTL32(x[d] ^ x[a], 16);
    x[c] = (x[c] + x[d]) >>> 0;
    x[b] = ROTL32(x[b] ^ x[c], 12);
    x[a] = (x[a] + x[b]) >>> 0;
    x[d] = ROTL32(x[d] ^ x[a], 8);
    x[c] = (x[c] + x[d]) >>> 0;
    x[b] = ROTL32(x[b] ^ x[c], 7);
  }

  private generateBlock(output: Uint32Array, outputOffset: number): void {
    this.state.set(ChaChaCore.CONSTANTS, 0);
    const seedView = new DataView(
      this.seed.buffer,
      this.seed.byteOffset,
    );
    for (let i = 0; i < 8; i++) {
      this.state[4 + i] = seedView.getUint32(i * 4, true);
    }
    this.state[12] = Number(this.blockCounter & MASK32);
    this.state[13] = Number((this.blockCounter >> 32n) & MASK32);
    this.state[14] = Number(this.streamId & MASK32);
    this.state[15] = Number((this.streamId >> 32n) & MASK32);

    const workingState = Uint32Array.from(this.state);

    for (let i = 0; i < this.numDoubleRounds; i++) {
      // Column rounds
      this.quarterRound(workingState, 0, 4, 8, 12);
      this.quarterRound(workingState, 1, 5, 9, 13);
      this.quarterRound(workingState, 2, 6, 10, 14);
      this.quarterRound(workingState, 3, 7, 11, 15);
      // Diagonal rounds
      this.quarterRound(workingState, 0, 5, 10, 15);
      this.quarterRound(workingState, 1, 6, 11, 12);
      this.quarterRound(workingState, 2, 7, 8, 13);
      this.quarterRound(workingState, 3, 4, 9, 14);
    }

    for (let i = 0; i < 16; i++) {
      output[outputOffset + i] = (workingState[i] + this.state[i]) >>> 0;
    }
    this.blockCounter = (this.blockCounter + 1n) & MASK64;
  }

  refillBuffer(buffer: Uint32Array): void {
    if (buffer.length !== BUFFER_WORDS) {
      throw new Error(`Buffer must be ${BUFFER_WORDS} u32 words long.`);
    }
    for (let i = 0; i < BUFFER_NUM_BLOCKS; i++) {
      this.generateBlock(buffer, i * BLOCK_WORDS);
    }
  }

  getSeed(): Uint8Array {
    return Uint8Array.from(this.seed);
  }

  getBlockPos(): bigint {
    return this.blockCounter;
  }

  setBlockPos(pos: bigint): void {
    this.blockCounter = pos & MASK64;
  }

  getStreamId(): bigint {
    return this.streamId;
  }

  setStreamId(streamId: bigint): void {
    this.streamId = streamId & MASK64;
  }

  getNumDoubleRounds(): number {
    return this.numDoubleRounds;
  }

  clone(): ChaChaCore {
    const newCore = new ChaChaCore(
      this.seed,
      this.streamId,
      this.numDoubleRounds,
    );
    newCore.blockCounter = this.blockCounter;
    return newCore;
  }
}

export class ChaChaRng {
  private core: ChaChaCore;
  private buffer: Uint32Array;
  private index: number;

  private constructor(seed: Uint8Array, rounds: number) {
    if (rounds <= 0 || rounds % 2 !== 0) {
      throw new Error("Rounds must be a positive even number.");
    }
    const numDoubleRounds = rounds / 2;
    this.core = new ChaChaCore(seed, 0n, numDoubleRounds);
    this.buffer = new Uint32Array(BUFFER_WORDS);
    this.index = BUFFER_WORDS; // exhausted; refills on first use
  }

  static fromSeed(seed: Uint8Array, rounds = 20): ChaChaRng {
    return new ChaChaRng(seed, rounds);
  }

  static fromRng(
    rng: { fillBytes: (bytes: Uint8Array) => void },
    rounds = 20,
  ): ChaChaRng {
    const seed = new Uint8Array(32);
    rng.fillBytes(seed);
    return ChaChaRng.fromSeed(seed, rounds);
  }

  private _refillBuffer(): void {
    this.core.refillBuffer(this.buffer);
    this.index = 0;
  }

  next_u32(): number {
    if (this.index >= BUFFER_WORDS) {
      this._refillBuffer();
    }
    return this.buffer[this.index++];
  }

  next_u64(): bigint {
    const low = BigInt(this.next_u32()) & MASK32;
    const high = BigInt(this.next_u32()) & MASK32;
    return (high << 32n) | low;
  }

  fillBytes(dest: Uint8Array): void {
    let offset = 0;
    const len = dest.length;
    const view = new DataView(dest.buffer, dest.byteOffset, dest.byteLength);
    while (offset + 4 <= len) {
      view.setUint32(offset, this.next_u32(), true);
      offset += 4;
    }
    if (offset < len) {
      const word = this.next_u32();
      for (let i = 0; i < len - offset; i++) {
        dest[offset + i] = (word >>> (i * 8)) & 0xff;
      }
    }
  }

  getWordPos(): bigint {
    const bufEndBlock = this.core.getBlockPos();
    const bufStartBlock =
      (bufEndBlock - BigInt(BUFFER_NUM_BLOCKS) + (1n << 64n)) & MASK64;
    const bufOffsetWords = BigInt(this.index);
    const blocksPart = bufOffsetWords / BigInt(BLOCK_WORDS);
    const wordsPart = bufOffsetWords % BigInt(BLOCK_WORDS);
    const posBlock = (bufStartBlock + blocksPart) & MASK64;
    return BigInt(posBlock) * BigInt(BLOCK_WORDS) + BigInt(wordsPart);
  }

  setWordPos(wordOffset: bigint): void {
    wordOffset = wordOffset & MASK68_WORD_POS;
    const blockForCore = (wordOffset / BigInt(BLOCK_WORDS)) & MASK64;
    this.core.setBlockPos(blockForCore);
    this._refillBuffer();
    this.index = Number(wordOffset % BigInt(BLOCK_WORDS));
  }

  getStream(): bigint {
    return this.core.getStreamId();
  }

  setStream(stream: bigint): void {
    this.core.setStreamId(stream & MASK64);
    if (this.index < BUFFER_WORDS) {
      const currentWordPos = this.getWordPos();
      this.setWordPos(currentWordPos);
    }
  }

  getSeed(): Uint8Array {
    return this.core.getSeed();
  }

  clone(): ChaChaRng {
    const cloned = new ChaChaRng(
      this.core.getSeed(),
      this.core.getNumDoubleRounds() * 2,
    );
    cloned.core = this.core.clone();
    cloned.buffer = Uint32Array.from(this.buffer);
    cloned.index = this.index;
    return cloned;
  }
}
