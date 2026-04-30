// Input validation. Each guardrail throws ValidationError with a human-readable
// message that the UI can render in-place next to the offending field — not a
// generic "invalid input" that sends operators on a scavenger hunt.

export class ValidationError extends Error {
  constructor(
    message: string,
    public field?: string,
  ) {
    super(message);
    this.name = 'ValidationError';
  }
}

export function validateProbability(name: string, x: number): void {
  if (!Number.isFinite(x) || x < 0 || x > 1) {
    throw new ValidationError(`${name} must be a number in [0, 1]; got ${x}`, name);
  }
}

export function validateProbabilityStrict(name: string, x: number): void {
  if (!Number.isFinite(x) || x <= 0 || x >= 1) {
    throw new ValidationError(`${name} must be a number in (0, 1); got ${x}`, name);
  }
}

export function validatePositive(name: string, x: number): void {
  if (!Number.isFinite(x) || x <= 0) {
    throw new ValidationError(`${name} must be a positive finite number; got ${x}`, name);
  }
}

export function validateNonNegative(name: string, x: number): void {
  if (!Number.isFinite(x) || x < 0) {
    throw new ValidationError(`${name} must be non-negative; got ${x}`, name);
  }
}

export function validateTriangular(name: string, min: number, mode: number, max: number): void {
  if (![min, mode, max].every(Number.isFinite)) {
    throw new ValidationError(`${name}: min/mode/max must be finite numbers`, name);
  }
  if (!(min < max)) {
    throw new ValidationError(`${name}: min must be < max; got ${min}/${max}`, name);
  }
  if (!(min <= mode && mode <= max)) {
    throw new ValidationError(`${name}: mode must be within [min, max]; got mode=${mode}`, name);
  }
}

export function validateLognormal(name: string, mean: number, sd: number): void {
  if (!(Number.isFinite(mean) && mean > 0)) {
    throw new ValidationError(`${name} lognormal mean must be > 0; got ${mean}`, name);
  }
  if (!(Number.isFinite(sd) && sd >= 0)) {
    throw new ValidationError(`${name} lognormal sd must be >= 0; got ${sd}`, name);
  }
}

export function validateBeta(name: string, mean: number, sd: number): void {
  if (!(Number.isFinite(mean) && mean > 0 && mean < 1)) {
    throw new ValidationError(`${name} beta mean must be in (0, 1); got ${mean}`, name);
  }
  const maxSd = Math.sqrt(mean * (1 - mean));
  if (!(Number.isFinite(sd) && sd > 0 && sd < maxSd)) {
    throw new ValidationError(
      `${name} beta SD must be in (0, ${maxSd.toFixed(4)}); got ${sd}`,
      name,
    );
  }
}

export type FunnelInputCheck = {
  spendCents: number;
  cpcCents: number;
  cvr: number;
  aovCents: number;
  refundRate: number;
  contributionMargin: number;
  fixedCostsCents: number;
};

/** Validate a deterministic funnel input set. */
export function validateFunnel(i: FunnelInputCheck): void {
  validatePositive('spend', i.spendCents);
  validatePositive('cpc', i.cpcCents);
  validateProbability('cvr', i.cvr);
  validatePositive('aov', i.aovCents);
  if (!(i.refundRate >= 0 && i.refundRate < 1)) {
    throw new ValidationError(`refundRate must be in [0, 1); got ${i.refundRate}`, 'refundRate');
  }
  if (!(i.contributionMargin > 0 && i.contributionMargin <= 1)) {
    throw new ValidationError(
      `contributionMargin must be in (0, 1]; got ${i.contributionMargin}`,
      'contributionMargin',
    );
  }
  validateNonNegative('fixedCosts', i.fixedCostsCents);
}
