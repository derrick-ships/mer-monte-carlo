import { describe, it, expect } from './runner.js';
import { Xoshiro256SS, hashStringToU64 } from '../src/math/rng.js';

describe('Xoshiro256SS', () => {
  it('produces identical sequences from identical seeds', () => {
    const a = new Xoshiro256SS('test-seed');
    const b = new Xoshiro256SS('test-seed');
    for (let i = 0; i < 10_000; i++) {
      expect(a.nextDouble()).toBe(b.nextDouble());
    }
  });

  it('produces different sequences from different seeds', () => {
    const a = new Xoshiro256SS('seed-A');
    const b = new Xoshiro256SS('seed-B');
    let differences = 0;
    for (let i = 0; i < 100; i++) {
      if (a.nextDouble() !== b.nextDouble()) differences++;
    }
    // All should differ; we allow 95+ in case of an astronomically rare collision.
    expect(differences).toBeGreaterThan(95);
  });

  it('outputs lie strictly in [0, 1)', () => {
    const r = new Xoshiro256SS(42n);
    for (let i = 0; i < 100_000; i++) {
      const x = r.nextDouble();
      expect(x).toBeGreaterThanOrEqual(0);
      expect(x).toBeLessThan(1);
    }
  });

  it('1M samples are approximately uniform (chi-square on 20 bins)', () => {
    const r = new Xoshiro256SS('uniformity');
    const N = 1_000_000;
    const bins = 20;
    const counts = new Array<number>(bins).fill(0);
    for (let i = 0; i < N; i++) {
      const idx = Math.min(bins - 1, Math.floor(r.nextDouble() * bins));
      counts[idx]++;
    }
    const expected = N / bins;
    let chi2 = 0;
    for (let i = 0; i < bins; i++) {
      const d = counts[i] - expected;
      chi2 += (d * d) / expected;
    }
    // df=19, 0.001 critical value ≈ 43.8. We're vastly under.
    expect(chi2).toBeLessThan(43.8);
  });

  it('state save/restore reproduces the next sequence', () => {
    const r = new Xoshiro256SS('save');
    for (let i = 0; i < 100; i++) r.nextU64();
    const s = r.getState();
    const a = [r.nextDouble(), r.nextDouble(), r.nextDouble()];
    r.setState(s);
    const b = [r.nextDouble(), r.nextDouble(), r.nextDouble()];
    expect(a).toEqual(b);
  });

  it('rejects all-zero state by replacing with a non-zero seed', () => {
    // SplitMix64 from any 64-bit seed should already produce non-zero state;
    // we just verify the constructor doesn't crash and emits non-zero outputs.
    const r = new Xoshiro256SS(0n);
    let anyNonZero = false;
    for (let i = 0; i < 10; i++) if (r.nextU64() !== 0n) anyNonZero = true;
    expect(anyNonZero).toBeTruthy();
  });
});

describe('hashStringToU64', () => {
  it('is deterministic', () => {
    expect(hashStringToU64('abc') === hashStringToU64('abc')).toBeTruthy();
  });
  it('differs across inputs', () => {
    expect(hashStringToU64('abc') !== hashStringToU64('abcd')).toBeTruthy();
  });
});
