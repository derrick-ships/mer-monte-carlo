// Streaming and batch statistics. We use Welford's online algorithm for the
// running mean/variance because numerically-stable updates over 200k samples
// matter — naive sum-of-squares can lose 4-5 digits of precision at that scale.
//
// Reference: Welford (1962), "Note on a method for calculating corrected sums
// of squares and products". Communications of the ACM.

export class Welford {
  count = 0;
  mean = 0;
  /** Sum of squared deviations from the running mean. */
  m2 = 0;

  push(x: number): void {
    this.count += 1;
    const delta = x - this.mean;
    this.mean += delta / this.count;
    const delta2 = x - this.mean;
    this.m2 += delta * delta2;
  }

  /** Sample variance (N-1 in denominator). Returns 0 with fewer than 2 samples. */
  variance(): number {
    return this.count > 1 ? this.m2 / (this.count - 1) : 0;
  }

  sd(): number {
    return Math.sqrt(this.variance());
  }

  /** Standard error of the mean. */
  seOfMean(): number {
    return this.count > 0 ? Math.sqrt(this.variance() / this.count) : Infinity;
  }
}

/**
 * Empirical quantile from a sorted array.
 *
 * DECISION: index = ceil(q × N) − 1 (Hyndman & Fan "Type 1", aka inverse-CDF).
 * Reasons:
 *   1. Spec mandates this exact formula for output integrity reproducibility.
 *   2. No interpolation = no spurious decimals in displayed percentiles.
 *   3. At N = 50k the difference vs Type 7 (R/numpy default) is in the 5th
 *      significant figure — irrelevant for decision-grade outputs.
 */
export function quantileSorted(sorted: ArrayLike<number>, q: number): number {
  if (sorted.length === 0) return Number.NaN;
  if (q <= 0) return sorted[0];
  if (q >= 1) return sorted[sorted.length - 1];
  const idx = Math.max(0, Math.min(sorted.length - 1, Math.ceil(q * sorted.length) - 1));
  return sorted[idx];
}

/**
 * Expected shortfall at level q: average of values in the lowest q-fraction.
 * For q = 0.05, this is the mean of the worst 5% of outcomes — the headline
 * risk metric we display ("if it goes badly, the average bad outcome is $X").
 *
 * Input array MUST be sorted ascending.
 */
export function expectedShortfall(sortedAscending: ArrayLike<number>, q: number): number {
  const N = sortedAscending.length;
  if (N === 0) return Number.NaN;
  const cutoff = Math.max(1, Math.floor(q * N));
  let sum = 0;
  for (let i = 0; i < cutoff; i++) sum += sortedAscending[i];
  return sum / cutoff;
}

/** P(X >= threshold) over an unsorted sample array. */
export function probabilityAtLeast(arr: ArrayLike<number>, threshold: number): number {
  let count = 0;
  for (let i = 0; i < arr.length; i++) if (arr[i] >= threshold) count++;
  return count / arr.length;
}

/** P(X > threshold) over an unsorted sample array. Strict inequality. */
export function probabilityGreater(arr: ArrayLike<number>, threshold: number): number {
  let count = 0;
  for (let i = 0; i < arr.length; i++) if (arr[i] > threshold) count++;
  return count / arr.length;
}

/**
 * Freedman–Diaconis bin width: 2 × IQR × N^(-1/3).
 * Used by the histogram renderer to choose bucket count.
 */
export function freedmanDiaconisBinWidth(sortedAscending: ArrayLike<number>): number {
  const N = sortedAscending.length;
  if (N < 4) return 1;
  const q1 = quantileSorted(sortedAscending, 0.25);
  const q3 = quantileSorted(sortedAscending, 0.75);
  const iqr = q3 - q1;
  if (iqr <= 0) return 1;
  return 2 * iqr * Math.pow(N, -1 / 3);
}
