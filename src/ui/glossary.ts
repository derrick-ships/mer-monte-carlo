// Single source of truth for plain-English definitions of every term that
// appears in the UI. Grandma test: a small business owner who has never
// run an ad campaign should be able to read any label and understand what
// they are looking at without consulting another tab.
//
// Each entry:
//   term       — the short name as it appears on screen
//   short      — one-line plain-English definition (always renders inline)
//   format     — what to type into the input (only for input fields)
//   example    — concrete example to anchor the abstraction

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
    short: 'How much money you put into advertising over the period.',
    format: 'Dollars',
    example: '5,000 means five thousand dollars.',
  },
  cpc: {
    term: 'Cost per click (CPC)',
    short: 'The average price you pay every time someone clicks your ad.',
    format: 'Dollars',
    example: '2.50 means two dollars and fifty cents per click.',
  },
  cvr: {
    term: 'Conversion rate (CVR)',
    short: 'Of the people who click your ad, the share who actually buy.',
    format: 'Decimal between 0 and 1',
    example: '0.04 means 4 out of every 100 visitors buy.',
  },
  aov: {
    term: 'Average order value (AOV)',
    short: 'The average dollar amount in each order placed.',
    format: 'Dollars',
    example: '150 means the typical customer spends $150 per order.',
  },
  refundRate: {
    term: 'Refund rate',
    short: 'The share of orders that get returned or refunded.',
    format: 'Decimal between 0 and 1',
    example: '0.05 means 5 out of every 100 orders come back.',
  },
  contributionMargin: {
    term: 'Contribution margin',
    short:
      'After product cost, shipping, and payment fees, the share of each sale you keep — before fixed overhead.',
    format: 'Decimal between 0 and 1',
    example: '0.60 means $0.60 of every $1.00 of net revenue is yours.',
  },
  fixedCosts: {
    term: 'Fixed costs',
    short: 'Monthly overhead that does not change with sales — rent, salaries, software.',
    format: 'Dollars',
    example: '5,000 means five thousand dollars per month.',
  },
  targetMER: {
    term: 'Target MER',
    short: 'The MER you want to hit. The simulator answers how confident you can be in reaching it.',
    format: 'A multiplier (x)',
    example: '3.0 means three dollars of revenue for every dollar of ad spend.',
  },
  targetProfit: {
    term: 'Target profit',
    short: 'The net profit goal you are trying to clear.',
    format: 'Dollars',
    example: '10,000 means ten thousand dollars of profit after every cost.',
  },
  iterations: {
    term: 'Iterations',
    short:
      'How many possible futures we simulate. More iterations = a sharper, more reliable answer.',
    example: '50,000 is a good default; 200,000 is research-grade.',
  },
  seed: {
    term: 'Seed',
    short:
      'A reproducibility code. Same inputs and same seed produce the exact same answer on every device.',
    example: 'Share a link with the seed and a colleague will see what you saw.',
  },

  // ---------- Outputs ----------
  mer: {
    term: 'MER — Marketing Efficiency Rate',
    short:
      'For every dollar of ad spend, how many dollars of revenue come back. The single most useful e-commerce ratio.',
    example: 'A MER of 3.0x means $3 of revenue for every $1 of ad spend.',
  },
  medianMER: {
    term: 'Median MER',
    short: 'The middle outcome — half of simulated futures land above, half below. The realistic typical case.',
  },
  pHitTarget: {
    term: 'Probability of hitting target',
    short:
      'Across all simulated futures, the share where MER lands at or above your target. This is the headline number.',
    example: '78% means 78 of every 100 simulated futures hit your target.',
  },
  pProfitable: {
    term: 'Probability of profit',
    short: 'The share of simulated futures where net profit is positive (you make money).',
  },
  netRevenue: {
    term: 'Net revenue',
    short: 'Revenue after refunds — the money you actually keep from sales, before product costs.',
  },
  grossRevenue: {
    term: 'Gross revenue',
    short: 'Total sales before refunds.',
  },
  netProfit: {
    term: 'Net profit',
    short: 'What is left after ad spend, product costs, and fixed overhead. Real money in the bank.',
  },
  cac: {
    term: 'CAC — Customer acquisition cost',
    short: 'The average ad spend it takes to win one paying customer.',
    example: 'A CAC of $30 means each new customer cost $30 in ads.',
  },
  spendRate: {
    term: 'Spend rate',
    short: 'The share of revenue eaten by advertising. The flip side of MER.',
  },
  breakEvenMER: {
    term: 'Break-even MER',
    short: 'The minimum MER you need just to cover product cost — anything below this loses money on every sale.',
  },
  requiredMER: {
    term: 'Required MER for target',
    short: 'The MER you would need to hit your target profit, given current spend and overhead.',
  },
  expectedShortfall: {
    term: 'Expected shortfall (worst 5%)',
    short:
      'When things go badly, how badly. The average outcome across the worst 5% of simulated futures.',
  },
  p10p90: {
    term: 'P10 / P90',
    short:
      'The 10th and 90th percentile — the realistic worst case (P10) and best case (P90). Most outcomes land between them.',
  },
  tornado: {
    term: 'Sensitivity (tornado)',
    short:
      'Which input matters most. Bars to the right help profit, bars to the left hurt it. Longest bar = biggest lever.',
  },

  // ---------- Distributions ----------
  fixed: {
    term: 'Fixed value',
    short: 'A single number with no uncertainty. Use this when you know the value exactly.',
  },
  triangular: {
    term: 'Triangular range',
    short:
      'A low, most-likely, and high estimate. Pick this when you have a gut-feel range but not a real distribution.',
    example: 'CPC: low $1.50, likely $2.50, high $4.00.',
  },
  lognormal: {
    term: 'Lognormal',
    short:
      'A right-skewed bell shape for prices. The right choice for CPC, AOV, and any positive amount that occasionally spikes.',
  },
  beta: {
    term: 'Beta',
    short:
      'A bell shape bounded between 0 and 1. The right choice for any rate (conversion, refund, margin).',
  },
};

export function lookup(key: string): GlossaryEntry | undefined {
  return GLOSSARY[key];
}
