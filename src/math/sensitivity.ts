// Sensitivity analysis via Pearson correlation between each input sample array
// and the chosen output. Ranked by |corr| for the tornado chart.
//
// WHY Pearson and not Sobol/Spearman:
//   - Inputs are independent (assumption of v1 model), so first-order Sobol
//     == squared Pearson correlation. Same ranking, simpler to compute.
//   - Spearman would be more robust to monotonic non-linearities, but the
//     funnel is already approximately log-linear in its inputs once you take
//     logs (MER = CVR × AOV × (1−r) / CPC), so Pearson on the linear scale
//     captures the right ordering for typical operating ranges.
//   - Pearson on logs would be even better; we stick with linear-scale to
//     keep the bar labels intuitive ("CPC contributes -0.62 to profit") rather
//     than asking operators to read log-elasticities.

export type SensitivityRow = {
  name: string;
  corr: number;
  /** |corr|, used for sort order. */
  abs: number;
};

/**
 * Pearson correlation. Two-pass for numerical stability over large N.
 * Returns 0 when either series has zero variance (no signal to report).
 */
export function pearson(x: ArrayLike<number>, y: ArrayLike<number>): number {
  const n = x.length;
  if (n !== y.length) throw new Error(`pearson: length mismatch (${n} vs ${y.length})`);
  if (n < 2) throw new Error(`pearson: need at least 2 points, got ${n}`);

  let mx = 0;
  let my = 0;
  for (let i = 0; i < n; i++) {
    mx += x[i];
    my += y[i];
  }
  mx /= n;
  my /= n;

  let num = 0;
  let dx2 = 0;
  let dy2 = 0;
  for (let i = 0; i < n; i++) {
    const dx = x[i] - mx;
    const dy = y[i] - my;
    num += dx * dy;
    dx2 += dx * dx;
    dy2 += dy * dy;
  }
  const denom = Math.sqrt(dx2 * dy2);
  return denom > 0 ? num / denom : 0;
}

/**
 * Compute correlation of each named input series against the output series,
 * sorted by absolute correlation descending. This is what the tornado chart
 * renders; ranking is what operators actually use to decide where to focus.
 */
export function tornadoData(
  inputs: { name: string; samples: ArrayLike<number> }[],
  output: ArrayLike<number>,
): SensitivityRow[] {
  return inputs
    .map((i) => {
      const corr = pearson(i.samples, output);
      return { name: i.name, corr, abs: Math.abs(corr) };
    })
    .sort((a, b) => b.abs - a.abs);
}
