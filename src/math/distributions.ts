// Distribution samplers. All samplers consume the RNG in a deterministic
// order so that (seed, config) -> sample sequence is reproducible.
//
// ROSTER:
//   Triangular  — gut-feel min/likely/max ranges
//   Lognormal   — strictly-positive, right-skewed monetary inputs (CPC, AOV)
//   Beta        — bounded rates in (0,1) (CTR, CVR, refund, contribution margin)
//
// We deliberately do NOT expose Normal as a user-facing distribution. Normal
// will sample impossible values (negative CPC, CVR > 1, etc.) and the only
// remediation — clipping — silently distorts the distribution shape. If you
// need a bell-shaped variable, pick the right bounded distribution.

import { Xoshiro256SS } from './rng.js';

export type Sampler = (rng: Xoshiro256SS) => number;

/**
 * Strictly-positive uniform sample. The probability of nextDouble() returning
 * exactly 0 is 2^-53 (one in ~9e15), but Math.log(0) is -Infinity which would
 * poison Box-Muller. We retry up to 4 times then fall through to a tiny
 * positive floor; the floor is unreachable in any practical run.
 */
function uniformOpen(rng: Xoshiro256SS): number {
  for (let i = 0; i < 4; i++) {
    const u = rng.nextDouble();
    if (u > 0) return u;
  }
  return Number.MIN_VALUE;
}

/**
 * Standard normal Z ~ N(0, 1) via Box-Muller (cosine form).
 *
 * DECISION: don't cache the unused sin pair. Caching adds cross-call state
 * that complicates reproducibility audits ("why did sample N consume two
 * uniforms but sample N+1 zero?"). The wasted work is ~0.5µs per call; at
 * 50k iters × ~7 normal draws per iter = 350k calls = ~175ms. Acceptable.
 */
export function nextStandardNormal(rng: Xoshiro256SS): number {
  const u1 = uniformOpen(rng);
  const u2 = rng.nextDouble();
  return Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
}

/**
 * Triangular(a, c, b) where a = min, c = mode, b = max.
 * Inverse-CDF sampling with the standard split at u = (c-a)/(b-a).
 */
export function sampleTriangular(rng: Xoshiro256SS, a: number, c: number, b: number): number {
  const u = rng.nextDouble();
  const fc = (c - a) / (b - a);
  if (u < fc) return a + Math.sqrt(u * (b - a) * (c - a));
  return b - Math.sqrt((1 - u) * (b - a) * (b - c));
}

/**
 * Lognormal sampler parameterized by the *desired* mean and SD of the lognormal
 * itself (not of the underlying normal). This is what users actually want when
 * they say "AOV averages $150 with SD $40".
 *
 * Identities:
 *   sigma^2 = ln(1 + s^2 / m^2)
 *   mu      = ln(m) - sigma^2 / 2
 *   X       = exp(mu + sigma * Z)
 */
export function sampleLognormal(rng: Xoshiro256SS, mean: number, sd: number): number {
  if (sd === 0) return mean; // degenerate: deterministic
  const variance = sd * sd;
  const sigma2 = Math.log(1 + variance / (mean * mean));
  const mu = Math.log(mean) - sigma2 / 2;
  const sigma = Math.sqrt(sigma2);
  return Math.exp(mu + sigma * nextStandardNormal(rng));
}

/**
 * Marsaglia–Tsang sampler for Gamma(shape = alpha, scale = 1).
 *
 * Reference:
 *   Marsaglia & Tsang (2000). "A Simple Method for Generating Gamma Variables."
 *   ACM Transactions on Mathematical Software, 26(3), 363–372.
 *
 * Why this and not Ahrens-Dieter or acceptance-rejection: M-T has uniformly
 * high acceptance rate (>96%), is short, and has a clean correctness proof.
 * For alpha < 1 we use the standard Stuart boost: Gamma(α) = Gamma(α+1) · U^(1/α).
 */
export function sampleGamma(rng: Xoshiro256SS, alpha: number): number {
  if (!(alpha > 0)) throw new Error(`Gamma alpha must be > 0; got ${alpha}`);
  if (alpha < 1) {
    const g = sampleGamma(rng, alpha + 1);
    const u = uniformOpen(rng);
    return g * Math.pow(u, 1 / alpha);
  }
  const d = alpha - 1 / 3;
  const c = 1 / Math.sqrt(9 * d);
  // Bound iterations only for hygiene; expected loops < 1.05.
  for (let safety = 0; safety < 1000; safety++) {
    let z: number;
    let v: number;
    do {
      z = nextStandardNormal(rng);
      v = 1 + c * z;
    } while (v <= 0);
    v = v * v * v;
    const u = uniformOpen(rng);
    // Squeeze test (avoids the log call ~99% of the time):
    if (u < 1 - 0.0331 * z * z * z * z) return d * v;
    if (Math.log(u) < 0.5 * z * z + d * (1 - v + Math.log(v))) return d * v;
  }
  throw new Error('Gamma sampler exceeded safety bound — unreachable for valid alpha');
}

/**
 * Convert user-friendly Beta parameters (mean, sd) to canonical (alpha, beta).
 * Throws on invalid combinations with a message the UI can render directly.
 */
export function betaParamsFromMeanSD(mean: number, sd: number): { alpha: number; beta: number } {
  if (!(mean > 0 && mean < 1)) {
    throw new Error(`Beta mean must be in (0, 1); got ${mean}`);
  }
  const variance = sd * sd;
  const maxVarStrict = mean * (1 - mean); // approached only by Bernoulli (alpha,beta -> 0)
  if (!(variance > 0 && variance < maxVarStrict)) {
    const maxSd = Math.sqrt(maxVarStrict);
    throw new Error(
      `Beta SD too large for mean ${mean}; max SD is ${maxSd.toFixed(4)}, got ${sd}`,
    );
  }
  const common = (mean * (1 - mean)) / variance - 1;
  return { alpha: mean * common, beta: (1 - mean) * common };
}

/** Beta(alpha, beta) via two Gammas. */
export function sampleBeta(rng: Xoshiro256SS, alpha: number, beta: number): number {
  const x = sampleGamma(rng, alpha);
  const y = sampleGamma(rng, beta);
  return x / (x + y);
}
