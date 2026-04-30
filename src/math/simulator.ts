// Monte Carlo simulator. Pure function: given (config, seed) it returns the
// same SimResult on every machine, every run.
//
// Loop body in order (per iteration):
//   1. Sample each input from its distribution (deterministic order — critical
//      for reproducibility). The order is: spend, cpc, cvr, aov, refundRate,
//      contributionMargin, fixedCosts.
//   2. Run the deterministic funnel chain.
//   3. Push raw samples into typed arrays for percentile + sensitivity.
//   4. Update Welford running stats for MER and NetProfit.
//   5. Every 1000 iters past the 5000 mark, check convergence (SE/mean < 1%).

import { Xoshiro256SS } from './rng.js';
import {
  type Sampler,
  sampleTriangular,
  sampleLognormal,
  sampleBeta,
  betaParamsFromMeanSD,
} from './distributions.js';
import { runFunnel } from './funnel.js';
import {
  Welford,
  quantileSorted,
  expectedShortfall,
  probabilityAtLeast,
  probabilityGreater,
} from './statistics.js';
import { tornadoData, type SensitivityRow } from './sensitivity.js';
import { runIntegrityChecks, type IntegrityResult } from './integrity.js';

export type DistSpec =
  | { kind: 'fixed'; value: number }
  | { kind: 'triangular'; min: number; mode: number; max: number }
  | { kind: 'lognormal'; mean: number; sd: number }
  | { kind: 'beta'; mean: number; sd: number };

export type SimConfig = {
  // All monetary specs are interpreted in cents.
  spend: DistSpec;
  cpc: DistSpec;
  cvr: DistSpec;
  aov: DistSpec;
  refundRate: DistSpec;
  contributionMargin: DistSpec;
  fixedCosts: DistSpec;
  /** MER threshold for the "P(MER >= target)" hero metric. */
  targetMER: number;
  targetProfitCents: number;
  /** Clamped to [1000, 200000] internally. */
  iterations: number;
  /** Hashable seed; either user-supplied or derived from a config hash. */
  seed: string;
  /** Stop early when SE/mean < 1% (after a 5000-iter floor). */
  earlyStop: boolean;
};

function buildSampler(spec: DistSpec, fieldName: string): Sampler {
  switch (spec.kind) {
    case 'fixed':
      return () => spec.value;
    case 'triangular': {
      const { min, mode, max } = spec;
      if (!(min < max && min <= mode && mode <= max)) {
        throw new Error(
          `${fieldName}: invalid Triangular(${min}, ${mode}, ${max}); require min <= mode <= max with min < max`,
        );
      }
      return (rng) => sampleTriangular(rng, min, mode, max);
    }
    case 'lognormal': {
      const { mean, sd } = spec;
      if (!(mean > 0 && sd >= 0)) {
        throw new Error(
          `${fieldName}: invalid Lognormal(mean=${mean}, sd=${sd}); require mean > 0, sd >= 0`,
        );
      }
      return (rng) => sampleLognormal(rng, mean, sd);
    }
    case 'beta': {
      // Pre-convert (mean, sd) -> (alpha, beta) once.
      const { alpha, beta } = betaParamsFromMeanSD(spec.mean, spec.sd);
      return (rng) => sampleBeta(rng, alpha, beta);
    }
  }
}

export type SimResult = {
  iterations: number;
  earlyStopped: boolean;
  /** Sorted ascending. */
  mer: Float64Array;
  netProfitCents: Float64Array;
  netRevenueCents: Float64Array;
  cacCents: Float64Array;
  /** Unsorted raw inputs (for sensitivity ranking and CSV export). */
  inputSamples: Record<string, Float64Array>;
  merStats: { mean: number; sd: number; seOfMean: number };
  netProfitStats: { mean: number; sd: number; seOfMean: number };
  medianMER: number;
  pHitTarget: number;
  pProfitable: number;
  expectedShortfallCents: number;
  tornado: SensitivityRow[];
  integrity: IntegrityResult;
  seed: string;
};

const MIN_ITERS = 1_000;
const MAX_ITERS = 200_000;
const CONV_FLOOR = 5_000;
const CONV_INTERVAL = 1_000;
const CONV_THRESHOLD = 0.01;

const FIELDS = [
  'spend',
  'cpc',
  'cvr',
  'aov',
  'refundRate',
  'contributionMargin',
  'fixedCosts',
] as const;
type FieldName = (typeof FIELDS)[number];

export function runSimulation(cfg: SimConfig): SimResult {
  const N = Math.max(MIN_ITERS, Math.min(MAX_ITERS, Math.floor(cfg.iterations)));
  const rng = new Xoshiro256SS(cfg.seed);

  const samplers: Record<FieldName, Sampler> = {
    spend: buildSampler(cfg.spend, 'spend'),
    cpc: buildSampler(cfg.cpc, 'cpc'),
    cvr: buildSampler(cfg.cvr, 'cvr'),
    aov: buildSampler(cfg.aov, 'aov'),
    refundRate: buildSampler(cfg.refundRate, 'refundRate'),
    contributionMargin: buildSampler(cfg.contributionMargin, 'contributionMargin'),
    fixedCosts: buildSampler(cfg.fixedCosts, 'fixedCosts'),
  };

  // Allocate at full N upfront, slice later if we early-stop.
  const mer = new Float64Array(N);
  const netProfit = new Float64Array(N);
  const netRevenue = new Float64Array(N);
  const cac = new Float64Array(N);
  const inputSamples: Record<FieldName, Float64Array> = {
    spend: new Float64Array(N),
    cpc: new Float64Array(N),
    cvr: new Float64Array(N),
    aov: new Float64Array(N),
    refundRate: new Float64Array(N),
    contributionMargin: new Float64Array(N),
    fixedCosts: new Float64Array(N),
  };

  const merWelford = new Welford();
  const profitWelford = new Welford();

  let stoppedAt = N;
  let earlyStopped = false;

  for (let i = 0; i < N; i++) {
    // Deterministic order — DO NOT reorder.
    const spend = samplers.spend(rng);
    const cpc = samplers.cpc(rng);
    const cvr = samplers.cvr(rng);
    const aov = samplers.aov(rng);
    const refundRate = samplers.refundRate(rng);
    const cm = samplers.contributionMargin(rng);
    const fixed = samplers.fixedCosts(rng);

    inputSamples.spend[i] = spend;
    inputSamples.cpc[i] = cpc;
    inputSamples.cvr[i] = cvr;
    inputSamples.aov[i] = aov;
    inputSamples.refundRate[i] = refundRate;
    inputSamples.contributionMargin[i] = cm;
    inputSamples.fixedCosts[i] = fixed;

    const f = runFunnel({
      spendCents: spend,
      cpcCents: cpc,
      cvr,
      aovCents: aov,
      refundRate,
      contributionMargin: cm,
      fixedCostsCents: fixed,
    });
    mer[i] = f.mer;
    netProfit[i] = f.netProfitCents;
    netRevenue[i] = f.netRevenueCents;
    cac[i] = f.cacCents ?? 0;

    merWelford.push(f.mer);
    profitWelford.push(f.netProfitCents);

    if (cfg.earlyStop && i + 1 >= CONV_FLOOR && (i + 1) % CONV_INTERVAL === 0) {
      // Use absolute mean to handle the (rare) case of mean MER ~ 0.
      const denom = Math.abs(merWelford.mean) || 1e-12;
      if (merWelford.seOfMean() / denom < CONV_THRESHOLD) {
        stoppedAt = i + 1;
        earlyStopped = true;
        break;
      }
    }
  }

  // Truncate buffers if early-stopped.
  const trunc = (a: Float64Array): Float64Array => (stoppedAt < N ? a.slice(0, stoppedAt) : a);
  const merF = trunc(mer);
  const profitF = trunc(netProfit);
  const revF = trunc(netRevenue);
  const cacF = trunc(cac);
  const inputF: Record<string, Float64Array> = {};
  for (const k of FIELDS) inputF[k] = trunc(inputSamples[k]);

  // Sort copies for percentile extraction; keep originals for sensitivity.
  const merSorted = new Float64Array(merF);
  merSorted.sort();
  const profitSorted = new Float64Array(profitF);
  profitSorted.sort();
  const revSorted = new Float64Array(revF);
  revSorted.sort();
  const cacSorted = new Float64Array(cacF);
  cacSorted.sort();

  const medianMER = quantileSorted(merSorted, 0.5);
  const pHitTarget = probabilityAtLeast(merF, cfg.targetMER);
  const pProfitable = probabilityGreater(profitF, 0);
  const esCents = expectedShortfall(profitSorted, 0.05);

  const tornado = tornadoData(
    FIELDS.map((name) => ({ name, samples: inputF[name] })),
    profitF,
  );

  const integrity = runIntegrityChecks({
    merSorted,
    profitSorted,
    pHitTarget,
    target: cfg.targetMER,
    mer: merF,
    seRatio: merWelford.seOfMean() / (Math.abs(merWelford.mean) || 1e-12),
  });

  return {
    iterations: stoppedAt,
    earlyStopped,
    mer: merSorted,
    netProfitCents: profitSorted,
    netRevenueCents: revSorted,
    cacCents: cacSorted,
    inputSamples: inputF,
    merStats: { mean: merWelford.mean, sd: merWelford.sd(), seOfMean: merWelford.seOfMean() },
    netProfitStats: {
      mean: profitWelford.mean,
      sd: profitWelford.sd(),
      seOfMean: profitWelford.seOfMean(),
    },
    medianMER,
    pHitTarget,
    pProfitable,
    expectedShortfallCents: esCents,
    tornado,
    integrity,
    seed: cfg.seed,
  };
}
