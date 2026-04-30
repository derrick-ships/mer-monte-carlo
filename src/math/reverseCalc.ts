// Reverse calculation: bisection on Spend to find the budget that delivers
// a target NetProfit at a target confidence level.
//
// IMPORTANT FRAMING (we surface this in the UI):
//   In the v1 funnel model, MER = (CVR × AOV × (1−r)) / CPC. Spend doesn't
//   appear, so MER is independent of Spend — the reverse-calc on MER is
//   meaningless under this model. What IS meaningful is reverse-calc on
//   NET PROFIT, which scales with Spend (Profit = Revenue × CM − Spend − Fixed).
//   So: "What spend gives me X% chance of $Y profit?", not "...of MER M?".

import { runSimulation, type SimConfig } from './simulator.js';

export type ReverseCalcSuccess = {
  ok: true;
  spendCents: number;
  achievedConfidence: number;
  steps: number;
};

export type ReverseCalcFailure = {
  ok: false;
  reason: string;
};

export type ReverseCalcResult = ReverseCalcSuccess | ReverseCalcFailure;

export type ReverseCalcOptions = {
  /** Search lower bound multiplier on the base spend. Default 0.1×. */
  lowMul?: number;
  /** Search upper bound multiplier on the base spend. Default 10×. */
  highMul?: number;
  /** Max bisection iterations. Default 25 (≈ 2^25 = 30M-fold range resolution). */
  maxSteps?: number;
  /** Convergence tolerance on probability. Default 1% absolute. */
  probTolerance?: number;
  /** Iterations per bisection step. Default 10k for speed. */
  itersPerStep?: number;
};

export function reverseCalcSpendForProfit(
  baseConfig: SimConfig,
  targetProfitCents: number,
  targetConfidence: number,
  options: ReverseCalcOptions = {},
): ReverseCalcResult {
  if (!(targetConfidence > 0 && targetConfidence < 1)) {
    return { ok: false, reason: `targetConfidence must be in (0,1); got ${targetConfidence}` };
  }
  if (baseConfig.spend.kind !== 'fixed') {
    return {
      ok: false,
      reason:
        'Reverse calc requires deterministic spend. Set spend distribution to "fixed" before running.',
    };
  }

  const {
    lowMul = 0.1,
    highMul = 10,
    maxSteps = 25,
    probTolerance = 0.01,
    itersPerStep = 10_000,
  } = options;

  const baseSpend = baseConfig.spend.value;
  let lo = baseSpend * lowMul;
  let hi = baseSpend * highMul;

  // probAt(spend) = P(NetProfit >= targetProfit) under the rest of cfg unchanged.
  const probAt = (spendCents: number): number => {
    const result = runSimulation({
      ...baseConfig,
      spend: { kind: 'fixed', value: spendCents },
      iterations: itersPerStep,
      earlyStop: false,
      // Keep seed identical across bisection steps so noise doesn't perturb
      // the search. The function is then deterministic in spend within this run.
    });
    let cnt = 0;
    const np = result.netProfitCents;
    for (let i = 0; i < np.length; i++) if (np[i] >= targetProfitCents) cnt++;
    return cnt / np.length;
  };

  let pLo = probAt(lo);
  let pHi = probAt(hi);

  // Bracket check: target confidence must lie between pLo and pHi (in either
  // direction, since the curve can be monotone increasing OR decreasing in
  // spend depending on whether more spend helps or hurts the target).
  if ((pLo - targetConfidence) * (pHi - targetConfidence) > 0) {
    return {
      ok: false,
      reason:
        `Target confidence ${(targetConfidence * 100).toFixed(0)}% unreachable in spend ` +
        `range [${(lo / 100).toFixed(0)}, ${(hi / 100).toFixed(0)}]. ` +
        `At low spend P=${pLo.toFixed(3)}, at high spend P=${pHi.toFixed(3)}.`,
    };
  }

  for (let step = 0; step < maxSteps; step++) {
    const mid = (lo + hi) / 2;
    const pMid = probAt(mid);
    if (Math.abs(pMid - targetConfidence) < probTolerance) {
      return { ok: true, spendCents: mid, achievedConfidence: pMid, steps: step + 1 };
    }
    // Keep the half-interval that still brackets the target.
    if ((pLo - targetConfidence) * (pMid - targetConfidence) <= 0) {
      hi = mid;
      pHi = pMid;
    } else {
      lo = mid;
      pLo = pMid;
    }
  }

  // Out of steps — return best-so-far midpoint with achieved confidence average.
  return {
    ok: true,
    spendCents: (lo + hi) / 2,
    achievedConfidence: (pLo + pHi) / 2,
    steps: maxSteps,
  };
}
