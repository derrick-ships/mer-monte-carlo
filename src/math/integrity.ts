// Output integrity checks. These run after every simulation. If any check
// fails, the UI surfaces a debug panel showing the failure list rather than
// rendering pretty charts on top of broken numbers — false confidence is the
// failure mode we're protecting against.

export type IntegrityResult = {
  ok: boolean;
  failures: string[];
};

export type IntegrityInputs = {
  merSorted: ArrayLike<number>;
  profitSorted: ArrayLike<number>;
  pHitTarget: number;
  target: number;
  /** Unsorted MER samples — used to recompute pHitTarget for cross-check. */
  mer: ArrayLike<number>;
  /** SE(mean MER) / |mean MER|. */
  seRatio: number;
};

function quantileTypeOne(sorted: ArrayLike<number>, q: number): number {
  const N = sorted.length;
  if (N === 0) return Number.NaN;
  return sorted[Math.max(0, Math.min(N - 1, Math.ceil(q * N) - 1))];
}

export function runIntegrityChecks(p: IntegrityInputs): IntegrityResult {
  const failures: string[] = [];

  // 1. Quantile coherence: P10 <= P50 <= P90 (strict ordering allows ties only
  // when the sample is degenerate, which is itself worth flagging upstream).
  const p10 = quantileTypeOne(p.merSorted, 0.1);
  const p50 = quantileTypeOne(p.merSorted, 0.5);
  const p90 = quantileTypeOne(p.merSorted, 0.9);
  if (!(p10 <= p50 && p50 <= p90)) {
    failures.push(`Quantile coherence broken: P10=${p10}, P50=${p50}, P90=${p90}`);
  }

  // 2. Probability consistency: cross-check the displayed P(MER >= target)
  // against a fresh count over the unsorted array. Within 0.5% absolute.
  let cnt = 0;
  for (let i = 0; i < p.mer.length; i++) if (p.mer[i] >= p.target) cnt++;
  const recomputed = cnt / p.mer.length;
  if (Math.abs(recomputed - p.pHitTarget) > 0.005) {
    failures.push(
      `P(MER>=target) mismatch: reported=${p.pHitTarget.toFixed(4)} recomputed=${recomputed.toFixed(4)}`,
    );
  }

  // 3. No NaN / Infinity in the result arrays. We scan once and stop at first
  // hit per array — one corruption is enough information.
  for (let i = 0; i < p.mer.length; i++) {
    if (!Number.isFinite(p.mer[i])) {
      failures.push(`Non-finite MER at index ${i}: ${p.mer[i]}`);
      break;
    }
  }
  for (let i = 0; i < p.profitSorted.length; i++) {
    if (!Number.isFinite(p.profitSorted[i])) {
      failures.push(`Non-finite NetProfit at index ${i}: ${p.profitSorted[i]}`);
      break;
    }
  }

  // 4. Convergence: SE/mean below 5%. Above that, the sim hasn't converged
  // and quantile estimates are too noisy to act on. Advisory rather than
  // hard fail — the user might have intentionally run a small sample.
  if (p.seRatio > 0.05) {
    failures.push(
      `Simulation under-converged: SE/mean = ${(p.seRatio * 100).toFixed(2)}% (target < 5%). Increase iteration count.`,
    );
  }

  return { ok: failures.length === 0, failures };
}
