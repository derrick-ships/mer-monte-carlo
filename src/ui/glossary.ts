// Single source of truth for plain-English definitions of every term that
// appears in the UI. Drunk-grandma test: a small business owner who has
// never run an ad campaign should still understand any label.
//
// Each entry:
//   term     — short name as it appears on screen
//   short    — plain-English definition (always renders inline)
//   format   — what to type (only for input fields)
//   example  — concrete example to anchor the abstraction

export type GlossaryEntry = {
  term: string;
  short: string;
  format?: string;
  example?: string;
};

export const GLOSSARY: Record<string, GlossaryEntry> = {
  // ---------- Inputs ----------
  spend: {
    term: 'Ad spend',
    short: 'What you spend on ads.',
    format: 'Dollars',
    example: '5,000 = $5,000.',
  },
  cpc: {
    term: 'Cost per click (CPC)',
    short: 'Average price per click on your ad.',
    format: 'Dollars',
    example: '2.50 = $2.50 per click.',
  },
  cvr: {
    term: 'Conversion rate (CVR)',
    short: 'Of clickers, the share who buy.',
    format: 'Decimal 0–1',
    example: '0.04 = 4 of every 100 clickers buy.',
  },
  aov: {
    term: 'Average order value (AOV)',
    short: 'Average dollar amount per order.',
    format: 'Dollars',
    example: '150 = $150 per order.',
  },
  refundRate: {
    term: 'Refund rate',
    short: 'Share of orders refunded or returned.',
    format: 'Decimal 0–1',
    example: '0.05 = 5 of every 100 orders.',
  },
  contributionMargin: {
    term: 'Contribution margin',
    short: 'Share of each sale left after product, shipping, and fees — before overhead.',
    format: 'Decimal 0–1',
    example: '0.60 = $0.60 of every $1.00.',
  },
  fixedCosts: {
    term: 'Fixed costs',
    short: 'Monthly overhead that does not move with sales — rent, salaries, software.',
    format: 'Dollars',
    example: '5,000 = $5,000/month.',
  },
  targetMER: {
    term: 'Target MER',
    short: 'The MER you want to hit.',
    format: 'Multiplier (x)',
    example: '3.0 = $3 of revenue per $1 of ad spend.',
  },
  targetProfit: {
    term: 'Target profit',
    short: 'The net profit you want to clear.',
    format: 'Dollars',
    example: '10,000 = $10,000 after every cost.',
  },
  iterations: {
    term: 'Iterations',
    short: 'How many futures we simulate. More = sharper answer.',
    example: '50,000 by default; 200,000 for research.',
  },
  seed: {
    term: 'Seed',
    short: 'Reproducibility code. Same inputs and seed = same answer, every device.',
    example: 'Share the link; a colleague sees what you saw.',
  },

  // ---------- Outputs ----------
  mer: {
    term: 'MER — Marketing Efficiency Rate',
    short: 'Revenue per dollar of ad spend.',
    example: '3.0x = $3 of revenue per $1 of ads.',
  },
  medianMER: {
    term: 'Median MER',
    short: 'The middle outcome — half of futures land above, half below.',
  },
  pHitTarget: {
    term: 'Probability of hitting target',
    short: 'Share of futures where MER lands at or above target.',
    example: '78% = 78 of 100 simulated futures hit it.',
  },
  pProfitable: {
    term: 'Probability of profit',
    short: 'Share of futures where net profit is positive.',
  },
  netRevenue: {
    term: 'Net revenue',
    short: 'Sales after refunds — before product cost.',
  },
  grossRevenue: {
    term: 'Gross revenue',
    short: 'Sales before refunds.',
  },
  netProfit: {
    term: 'Net profit',
    short: 'What is left after ads, product cost, and overhead.',
  },
  cac: {
    term: 'CAC — Customer acquisition cost',
    short: 'Ad spend per new customer.',
    example: '$30 = each new customer cost $30 in ads.',
  },
  spendRate: {
    term: 'Spend rate',
    short: 'Share of revenue eaten by ads. The flip side of MER.',
  },
  breakEvenMER: {
    term: 'Break-even MER',
    short: 'The minimum MER to cover product cost. Below this, every sale loses money.',
  },
  requiredMER: {
    term: 'Required MER for target',
    short: 'The MER needed to clear your target profit at current spend and overhead.',
  },
  expectedShortfall: {
    term: 'Expected shortfall (worst 5%)',
    short: 'Average outcome across the worst 5% of futures.',
  },
  p10p90: {
    term: 'P10 / P90',
    short: 'Realistic worst case (P10) and best case (P90). Most outcomes land between.',
  },
  tornado: {
    term: 'Sensitivity (tornado)',
    short: 'Bars right help profit, bars left hurt. Longest bar = biggest lever.',
  },

  // ---------- Distributions ----------
  fixed: {
    term: 'Fixed value',
    short: 'A single number. Use when you know the value exactly.',
  },
  triangular: {
    term: 'Triangular range',
    short: 'Low, most-likely, high. Use when you have a gut-feel range.',
    example: 'CPC: low $1.50, likely $2.50, high $4.00.',
  },
  lognormal: {
    term: 'Lognormal',
    short: 'Right-skewed bell for prices. Use for CPC, AOV, anything positive that occasionally spikes.',
  },
  beta: {
    term: 'Beta',
    short: 'Bell shape bounded 0–1. Use for any rate (conversion, refund, margin).',
  },
};

export function lookup(key: string): GlossaryEntry | undefined {
  return GLOSSARY[key];
}
