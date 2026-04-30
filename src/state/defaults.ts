// Industry-default presets. These are operator-friendly starting points, NOT
// authoritative benchmarks; users are expected to tune them. Numbers are
// based on widely cited 2023-2024 paid-media reports (WordStream, AdExpresso,
// LiteralMedia) and rounded to memorable values.

import type { DistSpec } from '../math/simulator.js';

export type Preset = {
  id: string;
  label: string;
  spend: DistSpec;
  cpc: DistSpec;
  cvr: DistSpec;
  aov: DistSpec;
  refundRate: DistSpec;
  contributionMargin: DistSpec;
  fixedCosts: DistSpec;
  targetMER: number;
  targetProfitCents: number;
};

// All monetary in cents.
export const PRESETS: Preset[] = [
  {
    id: 'meta-ecom',
    label: 'Meta paid e-com (mid-AOV)',
    spend: { kind: 'fixed', value: 5_000_00 },
    cpc: { kind: 'lognormal', mean: 250, sd: 80 },
    cvr: { kind: 'beta', mean: 0.022, sd: 0.006 },
    aov: { kind: 'lognormal', mean: 8_500, sd: 2_500 },
    refundRate: { kind: 'beta', mean: 0.06, sd: 0.02 },
    contributionMargin: { kind: 'beta', mean: 0.55, sd: 0.05 },
    fixedCosts: { kind: 'fixed', value: 1_500_00 },
    targetMER: 3.0,
    targetProfitCents: 1_000_00,
  },
  {
    id: 'google-search-leadgen',
    label: 'Google Search lead-gen (B2B)',
    spend: { kind: 'fixed', value: 10_000_00 },
    cpc: { kind: 'lognormal', mean: 280, sd: 120 },
    cvr: { kind: 'beta', mean: 0.045, sd: 0.012 },
    aov: { kind: 'lognormal', mean: 60_000, sd: 25_000 },
    refundRate: { kind: 'beta', mean: 0.02, sd: 0.01 },
    contributionMargin: { kind: 'beta', mean: 0.7, sd: 0.05 },
    fixedCosts: { kind: 'fixed', value: 5_000_00 },
    targetMER: 4.0,
    targetProfitCents: 5_000_00,
  },
  {
    id: 'tiktok-shop',
    label: 'TikTok Shop impulse',
    spend: { kind: 'fixed', value: 3_000_00 },
    cpc: { kind: 'lognormal', mean: 90, sd: 35 },
    cvr: { kind: 'beta', mean: 0.018, sd: 0.005 },
    aov: { kind: 'lognormal', mean: 4_500, sd: 1_500 },
    refundRate: { kind: 'beta', mean: 0.08, sd: 0.03 },
    contributionMargin: { kind: 'beta', mean: 0.5, sd: 0.05 },
    fixedCosts: { kind: 'fixed', value: 800_00 },
    targetMER: 3.5,
    targetProfitCents: 500_00,
  },
  {
    id: 'subscription-saas',
    label: 'Self-serve SaaS (CAC-driven)',
    spend: { kind: 'fixed', value: 20_000_00 },
    cpc: { kind: 'lognormal', mean: 320, sd: 80 },
    cvr: { kind: 'beta', mean: 0.025, sd: 0.006 },
    aov: { kind: 'lognormal', mean: 49_00, sd: 12_00 },
    refundRate: { kind: 'beta', mean: 0.03, sd: 0.01 },
    contributionMargin: { kind: 'beta', mean: 0.85, sd: 0.04 },
    fixedCosts: { kind: 'fixed', value: 30_000_00 },
    targetMER: 1.2,
    targetProfitCents: 0,
  },
  {
    id: 'high-aov-luxury',
    label: 'High-AOV luxury / DTC',
    spend: { kind: 'fixed', value: 8_000_00 },
    cpc: { kind: 'lognormal', mean: 380, sd: 120 },
    cvr: { kind: 'beta', mean: 0.012, sd: 0.004 },
    aov: { kind: 'lognormal', mean: 35_000, sd: 12_000 },
    refundRate: { kind: 'beta', mean: 0.12, sd: 0.04 },
    contributionMargin: { kind: 'beta', mean: 0.65, sd: 0.05 },
    fixedCosts: { kind: 'fixed', value: 3_000_00 },
    targetMER: 3.5,
    targetProfitCents: 3_000_00,
  },
  {
    id: 'mobile-app-installs',
    label: 'Mobile app — install + IAP',
    spend: { kind: 'fixed', value: 15_000_00 },
    cpc: { kind: 'lognormal', mean: 180, sd: 60 },
    cvr: { kind: 'beta', mean: 0.04, sd: 0.01 },
    aov: { kind: 'lognormal', mean: 12_00, sd: 4_00 },
    refundRate: { kind: 'beta', mean: 0.04, sd: 0.015 },
    contributionMargin: { kind: 'beta', mean: 0.7, sd: 0.05 },
    fixedCosts: { kind: 'fixed', value: 5_000_00 },
    targetMER: 1.8,
    targetProfitCents: 1_000_00,
  },
];

export const DEFAULT_PRESET_ID = 'meta-ecom';
