import { describe, it, expect } from './runner.js';
import { runIntegrityChecks } from '../src/math/integrity.js';

describe('runIntegrityChecks', () => {
  // Build a minimal-but-valid result fixture
  function fixture() {
    const N = 1000;
    const merUnsorted = new Float64Array(N);
    const profitUnsorted = new Float64Array(N);
    for (let i = 0; i < N; i++) {
      merUnsorted[i] = 1 + (i / N) * 2; // 1..3
      profitUnsorted[i] = (i - 500) * 100; // -50000..49900
    }
    const merSorted = new Float64Array(merUnsorted);
    merSorted.sort();
    const profitSorted = new Float64Array(profitUnsorted);
    profitSorted.sort();
    return {
      merSorted,
      profitSorted,
      mer: merUnsorted,
      target: 2,
      pHitTarget: 0.5,
      seRatio: 0.005,
    };
  }

  it('passes on a healthy result', () => {
    const r = runIntegrityChecks(fixture());
    expect(r.ok).toBeTruthy();
    expect(r.failures.length).toBe(0);
  });

  it('detects quantile incoherence (sort error)', () => {
    const f = fixture();
    // Corrupt the exact indices the checker samples: P10 uses ceil(0.1*N)-1 = 99,
    // P90 uses ceil(0.9*N)-1 = 899. Setting [99]=999 and [899]=-999 forces
    // P10 (999) > P90 (-999), which breaks the monotone ordering check.
    const corrupted = new Float64Array(f.merSorted);
    corrupted[99] = 999;   // P10 sample index — makes P10 = 999
    corrupted[899] = -999; // P90 sample index — makes P90 = -999 → P10 > P90
    const r = runIntegrityChecks({ ...f, merSorted: corrupted });
    expect(r.ok).toBeFalsy();
  });

  it('detects probability mismatch', () => {
    const f = fixture();
    const r = runIntegrityChecks({ ...f, pHitTarget: 0.9 }); // claims 90%, real is 50%
    expect(r.ok).toBeFalsy();
    expect(r.failures.some((m) => m.includes('mismatch'))).toBeTruthy();
  });

  it('detects NaN injection', () => {
    const f = fixture();
    f.mer[5] = NaN;
    const r = runIntegrityChecks(f);
    expect(r.ok).toBeFalsy();
    expect(r.failures.some((m) => m.includes('Non-finite'))).toBeTruthy();
  });

  it('detects under-converged simulations', () => {
    const f = fixture();
    const r = runIntegrityChecks({ ...f, seRatio: 0.1 });
    expect(r.ok).toBeFalsy();
    expect(r.failures.some((m) => m.includes('under-converged'))).toBeTruthy();
  });
});
