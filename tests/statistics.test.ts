import { describe, it, expect } from './runner.js';
import {
  Welford,
  quantileSorted,
  expectedShortfall,
  probabilityAtLeast,
  probabilityGreater,
  freedmanDiaconisBinWidth,
} from '../src/math/statistics.js';

function naiveMeanVar(arr: number[]): { mean: number; variance: number } {
  const n = arr.length;
  const mean = arr.reduce((s, x) => s + x, 0) / n;
  const v = arr.reduce((s, x) => s + (x - mean) ** 2, 0) / (n - 1);
  return { mean, variance: v };
}

describe('Welford', () => {
  it('mean and variance match naive within 1e-9', () => {
    const data = Array.from({ length: 10_000 }, (_, i) => Math.sin(i) * 100 + 50);
    const w = new Welford();
    for (const x of data) w.push(x);
    const naive = naiveMeanVar(data);
    expect(Math.abs(w.mean - naive.mean)).toBeLessThan(1e-9);
    expect(Math.abs(w.variance() - naive.variance)).toBeLessThan(1e-9);
  });
  it('zero variance for single sample', () => {
    const w = new Welford();
    w.push(42);
    expect(w.variance()).toBe(0);
  });
  it('SE of mean approaches 0 as N grows', () => {
    const w = new Welford();
    for (let i = 0; i < 100_000; i++) w.push(Math.random());
    expect(w.seOfMean()).toBeLessThan(0.005);
  });
});

describe('quantileSorted', () => {
  it('returns first/last for q=0/q=1', () => {
    const a = new Float64Array([1, 2, 3, 4, 5]);
    expect(quantileSorted(a, 0)).toBe(1);
    expect(quantileSorted(a, 1)).toBe(5);
  });
  it('uses ceil(q×N) − 1 indexing', () => {
    const a = new Float64Array([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
    // q=0.5: ceil(5) - 1 = 4 -> arr[4] = 5
    expect(quantileSorted(a, 0.5)).toBe(5);
    // q=0.1: ceil(1) - 1 = 0 -> arr[0] = 1
    expect(quantileSorted(a, 0.1)).toBe(1);
    // q=0.9: ceil(9) - 1 = 8 -> arr[8] = 9
    expect(quantileSorted(a, 0.9)).toBe(9);
  });
  it('returns NaN for empty array', () => {
    expect(quantileSorted(new Float64Array([]), 0.5)).toBeNaN();
  });
});

describe('expectedShortfall', () => {
  it('averages the bottom q-fraction', () => {
    // worst 5% of [1..100] is the bottom 5 values: mean(1..5) = 3
    const a = new Float64Array(100);
    for (let i = 0; i < 100; i++) a[i] = i + 1;
    expect(expectedShortfall(a, 0.05)).toBeCloseTo(3, 1e-12);
  });
  it('handles tiny arrays (returns first element)', () => {
    expect(expectedShortfall(new Float64Array([5, 10]), 0.05)).toBe(5);
  });
});

describe('probabilityAtLeast / probabilityGreater', () => {
  const a = new Float64Array([1, 2, 3, 4, 5]);
  it('counts >= threshold', () => {
    expect(probabilityAtLeast(a, 3)).toBeCloseTo(0.6, 1e-12); // 3,4,5
  });
  it('counts > threshold strictly', () => {
    expect(probabilityGreater(a, 3)).toBeCloseTo(0.4, 1e-12); // 4,5
  });
});

describe('freedmanDiaconisBinWidth', () => {
  it('returns positive width for typical data', () => {
    const a = new Float64Array(1000);
    for (let i = 0; i < 1000; i++) a[i] = i;
    const w = freedmanDiaconisBinWidth(a);
    expect(w).toBeGreaterThan(0);
  });
  it('returns fallback for degenerate data', () => {
    expect(freedmanDiaconisBinWidth(new Float64Array([1, 1, 1, 1]))).toBeGreaterThan(0);
  });
});
