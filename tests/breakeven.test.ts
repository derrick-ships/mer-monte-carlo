import { describe, it, expect } from './runner.js';
import {
  breakEvenMER,
  breakEvenMERWithFixed,
  requiredMER,
} from '../src/math/breakeven.js';

describe('breakEvenMER', () => {
  it('= 1 / CM for typical CMs', () => {
    expect(breakEvenMER(0.25)).toBeCloseTo(4, 1e-12);
    expect(breakEvenMER(0.5)).toBeCloseTo(2, 1e-12);
    expect(breakEvenMER(0.75)).toBeCloseTo(4 / 3, 1e-12);
  });
  it('rejects non-positive CM', () => {
    expect(() => breakEvenMER(0)).toThrow('Contribution margin must be in');
    expect(() => breakEvenMER(-0.1)).toThrow('Contribution margin must be in');
  });
  it('rejects CM > 1', () => {
    expect(() => breakEvenMER(1.01)).toThrow();
  });
});

describe('breakEvenMERWithFixed', () => {
  it('reduces to 1/CM when fixed = 0', () => {
    expect(breakEvenMERWithFixed(500_000, 0, 0.5)).toBeCloseTo(2, 1e-12);
  });
  it('correctly accounts for fixed costs', () => {
    // (500000 + 100000) / (500000 × 0.5) = 600000 / 250000 = 2.4
    expect(breakEvenMERWithFixed(500_000, 100_000, 0.5)).toBeCloseTo(2.4, 1e-12);
  });
  it('rejects spend <= 0', () => {
    expect(() => breakEvenMERWithFixed(0, 0, 0.5)).toThrow('Spend must be > 0');
  });
});

describe('requiredMER', () => {
  it('backs out target profit correctly', () => {
    // Want $200k profit on $500k spend, $100k fixed, CM=0.5
    // Required revenue × CM − Spend − Fixed = TargetProfit
    // Revenue = (500000 + 100000 + 200000) / 0.5 = 1_600_000
    // MER = 1600000 / 500000 = 3.2
    expect(requiredMER(500_000, 100_000, 200_000, 0.5)).toBeCloseTo(3.2, 1e-12);
  });
  it('reduces to break-even when target = 0', () => {
    expect(requiredMER(500_000, 100_000, 0, 0.5)).toBeCloseTo(
      breakEvenMERWithFixed(500_000, 100_000, 0.5),
      1e-12,
    );
  });
});
