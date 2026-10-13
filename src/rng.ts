/** What the engine needs from a random source; tests inject scripted implementations. */
export interface RandomSource {
  /** Uniform in [0, 1) */
  nextFloat(): number;
  /** Uniform integer in [0, n) */
  nextInt(n: number): number;
  /** Uniform integer in 1..6 */
  rollDie(): number;
}

const TWO_POW_32 = 0x100000000;
// Largest multiple of 6 that fits in 32 bits; values at or above it are rejected to avoid modulo bias.
const DIE_LIMIT = TWO_POW_32 - (TWO_POW_32 % 6);

/** Seedable xoshiro128** generator. Same seed ⇒ same sequence. */
export class Rng implements RandomSource {
  private s0: number;
  private s1: number;
  private s2: number;
  private s3: number;

  constructor(seed: number) {
    // Expand the 32-bit seed into 128 bits of state with splitmix32.
    let a = seed >>> 0;
    const next = (): number => {
      a = (a + 0x9e3779b9) | 0;
      let t = a ^ (a >>> 16);
      t = Math.imul(t, 0x21f0aaad);
      t ^= t >>> 15;
      t = Math.imul(t, 0x735a2d97);
      return (t ^ (t >>> 15)) >>> 0;
    };
    this.s0 = next();
    this.s1 = next();
    this.s2 = next();
    this.s3 = next();
  }

  nextUint32(): number {
    const s1 = this.s1;
    const x = Math.imul(s1, 5);
    const result = Math.imul((x << 7) | (x >>> 25), 9) >>> 0;
    const t = s1 << 9;
    this.s2 ^= this.s0;
    this.s3 ^= s1;
    this.s1 ^= this.s2;
    this.s0 ^= this.s3;
    this.s2 ^= t;
    const s3 = this.s3;
    this.s3 = (s3 << 11) | (s3 >>> 21);
    return result;
  }

  nextFloat(): number {
    return this.nextUint32() / TWO_POW_32;
  }

  nextInt(n: number): number {
    const limit = TWO_POW_32 - (TWO_POW_32 % n);
    let x = this.nextUint32();
    while (x >= limit) x = this.nextUint32();
    return x % n;
  }

  rollDie(): number {
    let x = this.nextUint32();
    while (x >= DIE_LIMIT) x = this.nextUint32();
    return (x % 6) + 1;
  }
}

/** In-place Fisher–Yates shuffle. */
export function shuffle<T>(items: { length: number; [index: number]: T }, rng: RandomSource): void {
  for (let i = items.length - 1; i > 0; i--) {
    const j = rng.nextInt(i + 1);
    const tmp = items[i] as T;
    items[i] = items[j] as T;
    items[j] = tmp;
  }
}
