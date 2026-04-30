// Break-even and required-MER calculations. These are the operator-decision
// layer of the calculator: "here's your number" becomes "here's the number
// you need to clear" only with these formulas.
//
// Algebra:
//   ContributionProfit = Revenue × CM − Spend
//   NetProfit          = ContributionProfit − FixedCosts
//   MER                = Revenue / Spend
//
// Setting NetProfit = 0 and solving for MER:
//   Revenue × CM − Spend − Fixed = 0
//   Revenue = (Spend + Fixed) / CM
//   MER = (Spend + Fixed) / (Spend × CM)
//
// Setting NetProfit = TargetProfit and solving for MER:
//   MER = (Spend + Fixed + TargetProfit) / (Spend × CM)
//
// When Fixed = 0 the first formula collapses to 1/CM, which we surface
// as the "pure unit-economics" break-even — the floor your contribution
// margin alone implies, before any overhead.

/** Break-even MER ignoring fixed costs. = 1 / CM. */
export function breakEvenMER(contributionMargin: number): number {
  if (!(contributionMargin > 0 && contributionMargin <= 1)) {
    throw new Error(`Contribution margin must be in (0, 1]; got ${contributionMargin}`);
  }
  return 1 / contributionMargin;
}

/** Break-even MER accounting for fixed costs (overhead, salaries, rent, etc.). */
export function breakEvenMERWithFixed(
  spendCents: number,
  fixedCostsCents: number,
  contributionMargin: number,
): number {
  if (!(spendCents > 0)) throw new Error(`Spend must be > 0; got ${spendCents}`);
  if (!(fixedCostsCents >= 0)) throw new Error(`Fixed costs must be >= 0; got ${fixedCostsCents}`);
  if (!(contributionMargin > 0 && contributionMargin <= 1)) {
    throw new Error(`Contribution margin must be in (0, 1]; got ${contributionMargin}`);
  }
  return (spendCents + fixedCostsCents) / (spendCents * contributionMargin);
}

/** MER required to hit a target profit (after fixed costs). */
export function requiredMER(
  spendCents: number,
  fixedCostsCents: number,
  targetProfitCents: number,
  contributionMargin: number,
): number {
  if (!(spendCents > 0)) throw new Error(`Spend must be > 0; got ${spendCents}`);
  if (!(fixedCostsCents >= 0)) throw new Error(`Fixed costs must be >= 0; got ${fixedCostsCents}`);
  if (!(contributionMargin > 0 && contributionMargin <= 1)) {
    throw new Error(`Contribution margin must be in (0, 1]; got ${contributionMargin}`);
  }
  return (spendCents + fixedCostsCents + targetProfitCents) / (spendCents * contributionMargin);
}
