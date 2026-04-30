import { describe, it, expect } from './runner.js';
import { runSimulation, type SimConfig } from '../src/math/simulator.js';

function baseConfig(): SimConfig {
  return {
    spend: { kind: 'fixed', value: 500_000 },
    cpc: { kind: 'lognormal', mean: 250, sd: 60 },
    cvr: { kind: 'beta', mean: 0.04, sd: 0.01 },
    aov: { kind: 'lognormal', mean: 15_000, sd: 3_000 },
    refundRate: { kind: 'beta', mean: 0.05, sd: 0.02 },
    contributionMargin: { kind: 'beta', mean: 0.6, sd: 0.05 },
    fixedCosts: { kind: 'fixed', value: 100_000 },
    targetMER: 2.0,
    targetProfitCents: 100_000,
    iterations: 10_000,
    seed: 'sim-test',
    earlyStop: false,
  };
}

describe('runSimulation', () => {
  it('reproducibility: identical inputs+seed produce identical output arrays', () => {
    const a = runSimulation(baseConfig());
    const b = runSimulation(baseConfig());
    expect(a.iterations).toBe(b.iterations);
    expect(a.medianMER).toBe(b.medianMER);
    expect(a.pHitTarget).toBe(b.pHitTarget);
    expect(a.pProfitable).toBe(b.pProfitable);
    // Spot-check the sorted MER array
    for (let i = 0; i < a.mer.length; i += 100) {
      expect(a.mer[i]).toBe(b.mer[i]);
    }
  });

  it('different seed produces different median MER', () => {
    const a = runSimulation(baseConfig());
    const b = runSimulation({ ...baseConfig(), seed: 'different-seed' });
    expect(a.medianMER === b.medianMER).toBeFalsy();
  });

  it('output arrays are sorted ascending', () => {
    const r = runSimulation(baseConfig());
    for (let i = 1; i < r.mer.length; i++) expect(r.mer[i]).toBeGreaterThanOrEqual(r.mer[i - 1]);
    for (let i = 1; i < r.netProfitCents.length; i++)
      expect(r.netProfitCents[i]).toBeGreaterThanOrEqual(r.netProfitCents[i - 1]);
  });

  it('integrity checks pass on a typical scenario', () => {
    const r = runSimulation({ ...baseConfig(), iterations: 50_000 });
    expect(r.integrity.ok).toBeTruthy();
  });

  it('SE/mean < 5% at N=50k', () => {
    const r = runSimulation({ ...baseConfig(), iterations: 50_000 });
    expect(r.merStats.seOfMean / r.merStats.mean).toBeLessThan(0.05);
  });

  it('early-stop fires at low scenario noise', () => {
    // A tight scenario should converge fast.
    const r = runSimulation({
      ...baseConfig(),
      cpc: { kind: 'lognormal', mean: 250, sd: 5 },
      cvr: { kind: 'beta', mean: 0.04, sd: 0.001 },
      aov: { kind: 'lognormal', mean: 15_000, sd: 100 },
      iterations: 50_000,
      earlyStop: true,
    });
    expect(r.earlyStopped).toBeTruthy();
    expect(r.iterations).toBeLessThan(50_000);
    expect(r.iterations).toBeGreaterThanOrEqual(5_000);
  });

  it('p-values are in [0, 1]', () => {
    const r = runSimulation(baseConfig());
    expect(r.pHitTarget).toBeGreaterThanOrEqual(0);
    expect(r.pHitTarget).toBeLessThanOrEqual(1);
    expect(r.pProfitable).toBeGreaterThanOrEqual(0);
    expect(r.pProfitable).toBeLessThanOrEqual(1);
  });

  it('rejects invalid Beta parameters at construction time', () => {
    expect(() =>
      runSimulation({
        ...baseConfig(),
        cvr: { kind: 'beta', mean: 0.04, sd: 0.5 }, // sd > sqrt(.04*.96) ≈ 0.196
      }),
    ).toThrow(/SD too large/);
  });

  it('clamps iterations into [1k, 200k]', () => {
    const r = runSimulation({ ...baseConfig(), iterations: 100 });
    expect(r.iterations).toBeGreaterThanOrEqual(1000);
  });
});
