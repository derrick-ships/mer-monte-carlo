// xoshiro256** PRNG with SplitMix64 seeding.
//
// WHY xoshiro256**:
//   - Period 2^256 - 1 (vastly more than the 2^53 doubles we ever sample)
//   - Passes BigCrush, no known statistical defects
//   - 64-bit native output, perfect for converting to a fair double in [0,1)
//
// WHY BigInt: JavaScript doesn't have native uint64. The two practical options
// are (a) BigInt or (b) splitting state across two Uint32 halves and emulating
// 64-bit ops by hand. BigInt is slower but the implementation is line-for-line
// the reference C; the manual-split approach has been a recurring source of
// off-by-one and rotation bugs in published JS implementations. Correctness
// first; the cost is ~1.5s for a 50k-iteration sim, which we run in a worker.
//
// WHY NOT Math.random: not seedable, not reproducible. Different engines and
// even different runs of the same engine produce different sequences.

const MASK64 = (1n << 64n) - 1n;

function rotl64(x: bigint, k: bigint): bigint {
  return ((x << k) | (x >> (64n - k))) & MASK64;
}

// SplitMix64 — the official seeder for xoshiro family. Don't seed xoshiro state
// directly from the user seed; SplitMix64 ensures any seed (even 0) produces a
// well-mixed initial state.
function splitMix64(seed: bigint): () => bigint {
  let z = seed & MASK64;
  return () => {
    z = (z + 0x9e3779b97f4a7c15n) & MASK64;
    let r = z;
    r = ((r ^ (r >> 30n)) * 0xbf58476d1ce4e5b9n) & MASK64;
    r = ((r ^ (r >> 27n)) * 0x94d049bb133111ebn) & MASK64;
    return (r ^ (r >> 31n)) & MASK64;
  };
}

// FNV-1a 64-bit hash. Used to convert a string seed (user-friendly) to a uint64.
// We only need this for seeding, so we don't care about its statistical quality
// downstream — SplitMix64 will mix the hash before xoshiro sees it.
export function hashStringToU64(s: string): bigint {
  let h = 0xcbf29ce484222325n;
  for (let i = 0; i < s.length; i++) {
    h = (h ^ BigInt(s.charCodeAt(i) & 0xff)) & MASK64;
    h = (h * 0x100000001b3n) & MASK64;
  }
  return h;
}

export class Xoshiro256SS {
  private s0: bigint;
  private s1: bigint;
  private s2: bigint;
  private s3: bigint;

  constructor(seed: bigint | string) {
    const seedU64 = typeof seed === 'string' ? hashStringToU64(seed) : seed & MASK64;
    const sm = splitMix64(seedU64);
    this.s0 = sm();
    this.s1 = sm();
    this.s2 = sm();
    this.s3 = sm();
    // xoshiro forbids the all-zero state (it's a fixed point of the recurrence).
    // Astronomically unlikely after SplitMix64, but cheap to defend.
    if (this.s0 === 0n && this.s1 === 0n && this.s2 === 0n && this.s3 === 0n) {
      this.s0 = 1n;
    }
  }

  /** Raw 64-bit unsigned output. Mostly for testing/seeding chains. */
  nextU64(): bigint {
    const result = (rotl64((this.s1 * 5n) & MASK64, 7n) * 9n) & MASK64;
    const t = (this.s1 << 17n) & MASK64;
    this.s2 = (this.s2 ^ this.s0) & MASK64;
    this.s3 = (this.s3 ^ this.s1) & MASK64;
    this.s1 = (this.s1 ^ this.s2) & MASK64;
    this.s0 = (this.s0 ^ this.s3) & MASK64;
    this.s2 = (this.s2 ^ t) & MASK64;
    this.s3 = rotl64(this.s3, 45n);
    return result;
  }

  /**
   * Uniform double in [0, 1). Uses the top 53 bits of a u64 — this is the
   * canonical Vigna construction that produces every representable double
   * in [0,1) with correct probability. Lower-bit constructions undersample
   * dyadic rationals.
   */
  nextDouble(): number {
    return Number(this.nextU64() >> 11n) / 0x20000000000000; // 2^53
  }

  /** For external state save/restore (e.g., reproducing a partial run). */
  getState(): [bigint, bigint, bigint, bigint] {
    return [this.s0, this.s1, this.s2, this.s3];
  }

  setState(s: [bigint, bigint, bigint, bigint]): void {
    this.s0 = s[0] & MASK64;
    this.s1 = s[1] & MASK64;
    this.s2 = s[2] & MASK64;
    this.s3 = s[3] & MASK64;
  }
}
