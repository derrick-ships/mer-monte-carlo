// Deterministic funnel chain. All monetary quantities are in cents (number, not
// integer-only — Monte Carlo samples are continuous). Intermediates are
// preserved on purpose: the tornado chart and funnel-stage diagnostics need
// them, and collapsing to MER = (CVR × AOV × (1-refund)) / CPC throws away
// information about which stage of the funnel is the variance driver.

export type FunnelInputs = {
  spendCents: number;
  cpcCents: number;
  cvr: number; // 0..1
  aovCents: number;
  refundRate: number; // 0..1, strictly < 1
  contributionMargin: number; // 0..1
  fixedCostsCents: number;
};

export type FunnelOutputs = {
  clicks: number;
  orders: number;
  grossRevenueCents: number;
  netRevenueCents: number;
  mer: number;
  /** = 1 / mer; the share of revenue eaten by paid acquisition. */
  spendRate: number;
  cacCents: number | null; // null when orders = 0 (undefined, not "infinite")
  contribProfitCents: number;
  netProfitCents: number;
};

/**
 * Single deterministic pass through the funnel. Every denominator is guarded.
 * Caller is expected to validate inputs first; this function will not throw,
 * but will return null/0/Infinity in degenerate cases. The simulator wraps
 * this so degenerate iterations are excluded from output statistics if needed.
 */
export function runFunnel(i: FunnelInputs): FunnelOutputs {
  const clicks = i.cpcCents > 0 ? i.spendCents / i.cpcCents : 0;
  const orders = clicks * i.cvr;
  const grossRevenueCents = orders * i.aovCents;
  const netRevenueCents = grossRevenueCents * (1 - i.refundRate);
  const mer = i.spendCents > 0 ? netRevenueCents / i.spendCents : 0;
  // spendRate is 1/MER but we surface it because operators talk in either dialect.
  const spendRate = netRevenueCents > 0 ? i.spendCents / netRevenueCents : Infinity;
  const cacCents = orders > 0 ? i.spendCents / orders : null;
  const contribProfitCents = netRevenueCents * i.contributionMargin - i.spendCents;
  const netProfitCents = contribProfitCents - i.fixedCostsCents;
  return {
    clicks,
    orders,
    grossRevenueCents,
    netRevenueCents,
    mer,
    spendRate,
    cacCents,
    contribProfitCents,
    netProfitCents,
  };
}
