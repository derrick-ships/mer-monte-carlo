import { describe, it, expect } from './runner.js';
import { Xoshiro256SS } from '../src/math/rng.js';
import {
  sampleTriangular,
  sampleLognormal,
  sampleBeta,
  sampleGamma,
  betaParamsFromMeanSD,
  nextStandardNormal,
} from '../src/math/distributions.js';

function meanSd(arr: number[]): { mean: number; sd: number } {
  const n = arr.length;
  const mean = arr.reduce((s, x) => s + x, 0) / n;
  const v = arr.reduce((s, x) => s + (x - mean) ** 2, 0) / (n - 1);
  return { mean, sd: Math.sqrt(v) };
}

describe('Triangular', () => {
  it('empirical mean ~ theoretical (a+c+b)/3 within 1%', () => {
    const r = new Xoshiro256SS('tri');
    const N = 100_000;
    const a = 1, c = 3, b = 10;
    const samples: number[] = [];
    for (let i = 0; i < N; i++) samples.push(sampleTriangular(r, a, c, b));
    const { mean } = meanSd(samples);
    const theo = (a + c + b) / 3; // = 4.6667
    expect(mean).toBeWithinPercent(theo, 1);
  });

  it('all samples lie in [a, b]', () => {
    const r = new Xoshiro256SS('tri-bounds');
    for (let i = 0; i < 100_000; i++) {
      const x = sampleTriangular(r, 2, 5, 8);
      expect(x).toBeGreaterThanOrEqual(2);
      expect(x).toBeLessThanOrEqual(8);
    }
  });

  it('handles symmetric Triangular(a, (a+b)/2, b)', () => {
    const r = new Xoshiro256SS('tri-sym');
    const N = 50_000;
    const samples: number[] = [];
    for (let i = 0; i < N; i++) samples.push(sampleTriangular(r, 0, 5, 10));
    const { mean } = meanSd(samples);
    expect(mean).toBeWithinPercent(5, 1);
  });
});

describe('Lognormal', () => {
  it('empirical mean and SD match user-input mean and SD within 2%', () => {
    const r = new Xoshiro256SS('ln');
    const N = 200_000;
    const m = 250;
    const s = 60;
    const samples: number[] = [];
    for (let i = 0; i < N; i++) samples.push(sampleLognormal(r, m, s));
    const { mean, sd } = meanSd(samples);
    expect(mean).toBeWithinPercent(m, 2);
    expect(sd).toBeWithinPercent(s, 5); // SD converges slower
  });

  it('all samples are strictly positive', () => {
    const r = new Xoshiro256SS('ln-pos');
    for (let i = 0; i < 50_000; i++) {
      expect(sampleLognormal(r, 100, 30)).toBeGreaterThan(0);
    }
  });

  it('zero SD returns the mean deterministically', () => {
    const r = new Xoshiro256SS('ln-det');
    expect(sampleLognormal(r, 42, 0)).toBe(42);
  });
});

describe('Gamma (Marsaglia-Tsang)', () => {
  it('empirical mean ~ alpha (with scale=1) for alpha > 1', () => {
    const r = new Xoshiro256SS('gamma1');
    const N = 100_000;
    for (const alpha of [1.5, 3, 7.5]) {
      const samples: number[] = [];
      for (let i = 0; i < N; i++) samples.push(sampleGamma(r, alpha));
      const { mean } = meanSd(samples);
      expect(mean).toBeWithinPercent(alpha, 2);
    }
  });

  it('handles alpha < 1 via Stuart boost', () => {
    const r = new Xoshiro256SS('gamma2');
    const N = 100_000;
    const alpha = 0.5;
    const samples: number[] = [];
    for (let i = 0; i < N; i++) samples.push(sampleGamma(r, alpha));
    const { mean } = meanSd(samples);
    expect(mean).toBeWithinPercent(alpha, 3);
  });

  it('rejects alpha <= 0', () => {
    const r = new Xoshiro256SS('g');
    expect(() => sampleGamma(r, 0)).toThrow('alpha must be > 0');
    expect(() => sampleGamma(r, -1)).toThrow('alpha must be > 0');
  });
});

describe('Beta', () => {
  it('mean=0.5 sd=0.1 produces (alpha,beta) = (12, 12)', () => {
    const { alpha, beta } = betaParamsFromMeanSD(0.5, 0.1);
    expect(alpha).toBeCloseTo(12, 1e-9);
    expect(beta).toBeCloseTo(12, 1e-9);
  });

  it('empirical mean and SD match within 2%', () => {
    const r = new Xoshiro256SS('beta');
    const { alpha, beta } = betaParamsFromMeanSD(0.045, 0.012);
    const N = 100_000;
    const samples: number[] = [];
    for (let i = 0; i < N; i++) samples.push(sampleBeta(r, alpha, beta));
    const { mean, sd } = meanSd(samples);
    expect(mean).toBeWithinPercent(0.045, 2);
    expect(sd).toBeWithinPercent(0.012, 5);
  });

  it('all samples lie strictly in (0, 1)', () => {
    const r = new Xoshiro256SS('beta-bounds');
    const { alpha, beta } = betaParamsFromMeanSD(0.3, 0.05);
    for (let i = 0; i < 50_000; i++) {
      const x = sampleBeta(r, alpha, beta);
      expect(x).toBeGreaterThan(0);
      expect(x).toBeLessThan(1);
    }
  });

  it('rejects mean outside (0,1)', () => {
    expect(() => betaParamsFromMeanSD(0, 0.1)).toThrow('mean must be in (0, 1)');
    expect(() => betaParamsFromMeanSD(1, 0.1)).toThrow('mean must be in (0, 1)');
    expect(() => betaParamsFromMeanSD(-0.1, 0.1)).toThrow('mean must be in (0, 1)');
  });

  it('rejects sd >= sqrt(p(1-p))', () => {
    // p=0.5 -> max sd = 0.5; sd=0.5 should reject.
    expect(() => betaParamsFromMeanSD(0.5, 0.5)).toThrow('SD too large');
    expect(() => betaParamsFromMeanSD(0.5, 0.6)).toThrow('SD too large');
  });

  it('rejects sd <= 0', () => {
    expect(() => betaParamsFromMeanSD(0.5, 0)).toThrow('SD too large');
  });
});

describe('Standard normal (Box-Muller)', () => {
  it('empirical mean ~ 0 and sd ~ 1 within 2%', () => {
    const r = new Xoshiro256SS('normal');
    const samples: number[] = [];
    for (let i = 0; i < 200_000; i++) samples.push(nextStandardNormal(r));
    const { mean, sd } = meanSd(samples);
    expect(Math.abs(mean)).toBeLessThan(0.02);
    expect(sd).toBeWithinPercent(1, 2);
  });
});
