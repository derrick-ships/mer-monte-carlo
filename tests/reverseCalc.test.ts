import { describe, it, expect } from './runner.js';
import { reverseCalcSpendForProfit } from '../src/math/reverseCalc.js';
import type { SimConfig } from '../src/math/simulator.js';

function baseConfig(): SimConfig {
  return {
    spend: { kind: 'fixed', value: 500_000 },
    cpc: { kind: 'lognormal', mean: 250, sd: 30 },
    cvr: { kind: 'beta', mean: 0.04, sd: 0.005 },
    aov: { kind: 'lognormal', mean: 15_000, sd: 1_500 },
    refundRate: { kind: 'beta', mean: 0.05, sd: 0.01 },
    contributionMargin: { kind: 'beta', mean: 0.6, sd: 0.03 },
    fixedCosts: { kind: 'fixed', value: 50_000 },
    targetMER: 2.0,
    targetProfitCents: 100_000,
    iterations: 10_000,
    seed: 'rev',
    earlyStop: false,
  };
}

describe('reverseCalcSpendForProfit', () => {
  it('finds spend within bracket for an achievable target', () => {
    // At base spend $5k, with median MER ~ (0.04 × 15000 × 0.95)/250 = 2.28,
    // expected profit ≈ revenue × CM − spend − fixed
    //                 = (500000 × 2.28 × 0.6) − 500000 − 50000 = 684000 − 550000 = 134000
    // Target $100 profit (in cents) = 100k cents = $1k → easy.
    const r = reverseCalcSpendForProfit(baseConfig(), 100_000, 0.5, {
      maxSteps: 25,
      itersPerStep: 5_000,
    });
    if (!r.ok) throw new Error(`Expected ok, got: ${r.reason}`);
    expect(r.spendCents).toBeGreaterThan(0);
    expect(Math.abs(r.achievedConfidence - 0.5)).toBeLessThan(0.05);
  });

  it('returns failure when target unreachable', () => {
    // Target $10M profit on a $5k spend funnel — out of range.
    const r = reverseCalcSpendForProfit(baseConfig(), 1_000_000_000, 0.9, {
      itersPerStep: 3_000,
    });
    expect(r.ok).toBeFalsy();
  });

  it('rejects non-fixed base spend', () => {
    const cfg = baseConfig();
    cfg.spend = { kind: 'lognormal', mean: 500_000, sd: 50_000 };
    const r = reverseCalcSpendForProfit(cfg, 100_000, 0.5);
    expect(r.ok).toBeFalsy();
    if (!r.ok) expect(r.reason).toBeTruthy();
  });

  it('rejects targetConfidence outside (0,1)', () => {
    expect(reverseCalcSpendForProfit(baseConfig(), 1_000, 0).ok).toBeFalsy();
    expect(reverseCalcSpendForProfit(baseConfig(), 1_000, 1).ok).toBeFalsy();
  });
});
