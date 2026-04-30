import { describe, it, expect } from './runner.js';
import {
  validatePositive,
  validateNonNegative,
  validateProbability,
  validateProbabilityStrict,
  validateTriangular,
  validateLognormal,
  validateBeta,
  validateFunnel,
  ValidationError,
} from '../src/math/validation.js';

describe('validators', () => {
  it('validatePositive', () => {
    expect(() => validatePositive('x', 0)).toThrow();
    expect(() => validatePositive('x', -1)).toThrow();
    expect(() => validatePositive('x', NaN)).toThrow();
    validatePositive('x', 1);
  });
  it('validateNonNegative', () => {
    validateNonNegative('x', 0);
    expect(() => validateNonNegative('x', -1)).toThrow();
  });
  it('validateProbability', () => {
    validateProbability('x', 0);
    validateProbability('x', 1);
    expect(() => validateProbability('x', -0.01)).toThrow();
    expect(() => validateProbability('x', 1.01)).toThrow();
  });
  it('validateProbabilityStrict', () => {
    validateProbabilityStrict('x', 0.5);
    expect(() => validateProbabilityStrict('x', 0)).toThrow();
    expect(() => validateProbabilityStrict('x', 1)).toThrow();
  });
  it('validateTriangular', () => {
    validateTriangular('x', 1, 2, 3);
    expect(() => validateTriangular('x', 3, 2, 1)).toThrow();
    expect(() => validateTriangular('x', 1, 5, 3)).toThrow(); // mode out of range
  });
  it('validateLognormal', () => {
    validateLognormal('x', 100, 10);
    expect(() => validateLognormal('x', 0, 10)).toThrow();
    expect(() => validateLognormal('x', -1, 10)).toThrow();
    expect(() => validateLognormal('x', 100, -1)).toThrow();
  });
  it('validateBeta', () => {
    validateBeta('x', 0.5, 0.1);
    expect(() => validateBeta('x', 0, 0.1)).toThrow();
    expect(() => validateBeta('x', 1, 0.1)).toThrow();
    expect(() => validateBeta('x', 0.5, 0.5)).toThrow();
  });
  it('validateFunnel passes a healthy scenario', () => {
    validateFunnel({
      spendCents: 500_000,
      cpcCents: 250,
      cvr: 0.04,
      aovCents: 15_000,
      refundRate: 0.05,
      contributionMargin: 0.6,
      fixedCostsCents: 100_000,
    });
  });
  it('validateFunnel rejects refundRate >= 1', () => {
    expect(() =>
      validateFunnel({
        spendCents: 500_000,
        cpcCents: 250,
        cvr: 0.04,
        aovCents: 15_000,
        refundRate: 1,
        contributionMargin: 0.6,
        fixedCostsCents: 0,
      }),
    ).toThrow();
  });
  it('throws ValidationError instances with field set', () => {
    try {
      validatePositive('cpc', -1);
      throw new Error('should not reach');
    } catch (e) {
      expect(e instanceof ValidationError).toBeTruthy();
      if (e instanceof ValidationError) expect(e.field).toBe('cpc');
    }
  });
});
