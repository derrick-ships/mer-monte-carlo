import { describe, it, expect } from './runner.js';
import { pearson, tornadoData } from '../src/math/sensitivity.js';

describe('pearson', () => {
  it('= 1 for perfectly positively correlated data', () => {
    const x = new Float64Array([1, 2, 3, 4, 5]);
    const y = new Float64Array([2, 4, 6, 8, 10]);
    expect(pearson(x, y)).toBeCloseTo(1, 1e-12);
  });
  it('= -1 for perfectly negatively correlated data', () => {
    const x = new Float64Array([1, 2, 3, 4, 5]);
    const y = new Float64Array([10, 8, 6, 4, 2]);
    expect(pearson(x, y)).toBeCloseTo(-1, 1e-12);
  });
  it('= 0 for uncorrelated symmetric data', () => {
    const x = new Float64Array([-2, -1, 0, 1, 2]);
    const y = new Float64Array([4, 1, 0, 1, 4]); // y = x^2
    expect(pearson(x, y)).toBeCloseTo(0, 1e-12);
  });
  it('matches a known reference (scipy.stats.pearsonr)', () => {
    // Verified from first principles: r = 40.5 / sqrt(17.5 * 96.833) ≈ 0.9838
    // (The original comment cited 0.991361 which was an incorrect reference value.)
    const x = new Float64Array([1, 2, 3, 4, 5, 6]);
    const y = new Float64Array([2, 3, 5, 7, 11, 13]);
    expect(pearson(x, y)).toBeCloseTo(0.9838, 1e-4);
  });
  it('throws on length mismatch', () => {
    expect(() => pearson(new Float64Array([1, 2]), new Float64Array([1, 2, 3]))).toThrow(
      'length mismatch',
    );
  });
  it('returns 0 when one series has zero variance', () => {
    const x = new Float64Array([1, 1, 1, 1]);
    const y = new Float64Array([1, 2, 3, 4]);
    expect(pearson(x, y)).toBe(0);
  });
});

describe('tornadoData', () => {
  it('ranks by |corr| descending', () => {
    const out = new Float64Array([1, 2, 3, 4, 5]);
    const inputs = [
      { name: 'weak', samples: new Float64Array([5, 1, 4, 2, 3]) },
      { name: 'strong-pos', samples: new Float64Array([1, 2, 3, 4, 5]) },
      { name: 'strong-neg', samples: new Float64Array([5, 4, 3, 2, 1]) },
    ];
    const result = tornadoData(inputs, out);
    expect(result[0]!.name).toBe('strong-pos');
    expect(result[1]!.name).toBe('strong-neg');
    expect(result[2]!.name).toBe('weak');
    expect(result[0]!.abs).toBeCloseTo(1, 1e-12);
    expect(result[1]!.abs).toBeCloseTo(1, 1e-12);
  });
});
