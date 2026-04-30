import { describe, it, expect } from './runner.js';
import { runFunnel } from '../src/math/funnel.js';

describe('runFunnel', () => {
  // Hand-calculated reference scenario, all in cents:
  //   Spend 500_000 ($5,000)
  //   CPC   250     ($2.50)
  //   CVR   0.04    (4%)
  //   AOV   15_000  ($150)
  //   Refund 0.05   (5%)
  //   CM    0.6     (60%)
  //   Fixed 100_000 ($1,000)
  //
  //   clicks = 500000/250 = 2000
  //   orders = 2000 × 0.04 = 80
  //   gross  = 80 × 15000 = 1_200_000
  //   net    = 1200000 × 0.95 = 1_140_000
  //   MER    = 1140000 / 500000 = 2.28
  //   spendRate = 500000/1140000 ≈ 0.4386
  //   CAC    = 500000/80 = 6250
  //   contribProfit = 1140000 × 0.6 − 500000 = 684000 − 500000 = 184000
  //   netProfit     = 184000 − 100000 = 84000
  it('matches hand-calculated reference scenario', () => {
    const out = runFunnel({
      spendCents: 500_000,
      cpcCents: 250,
      cvr: 0.04,
      aovCents: 15_000,
      refundRate: 0.05,
      contributionMargin: 0.6,
      fixedCostsCents: 100_000,
    });
    expect(out.clicks).toBeCloseTo(2000, 1e-9);
    expect(out.orders).toBeCloseTo(80, 1e-9);
    expect(out.grossRevenueCents).toBeCloseTo(1_200_000, 1e-6);
    expect(out.netRevenueCents).toBeCloseTo(1_140_000, 1e-6);
    expect(out.mer).toBeCloseTo(2.28, 1e-9);
    expect(out.spendRate).toBeCloseTo(500_000 / 1_140_000, 1e-9);
    expect(out.cacCents).toBeCloseTo(6250, 1e-9);
    expect(out.contribProfitCents).toBeCloseTo(184_000, 1e-6);
    expect(out.netProfitCents).toBeCloseTo(84_000, 1e-6);
  });

  it('returns null CAC when orders = 0', () => {
    const out = runFunnel({
      spendCents: 500_000,
      cpcCents: 250,
      cvr: 0,
      aovCents: 15_000,
      refundRate: 0,
      contributionMargin: 0.6,
      fixedCostsCents: 0,
    });
    expect(out.cacCents).toBe(null);
    expect(out.mer).toBe(0);
  });

  it('returns mer=0 and clicks=0 when spend=0', () => {
    const out = runFunnel({
      spendCents: 0,
      cpcCents: 250,
      cvr: 0.04,
      aovCents: 15_000,
      refundRate: 0,
      contributionMargin: 0.6,
      fixedCostsCents: 0,
    });
    expect(out.mer).toBe(0);
    expect(out.clicks).toBe(0);
  });

  it('returns clicks=0 when CPC = 0 (no Infinity)', () => {
    const out = runFunnel({
      spendCents: 500_000,
      cpcCents: 0,
      cvr: 0.04,
      aovCents: 15_000,
      refundRate: 0,
      contributionMargin: 0.6,
      fixedCostsCents: 0,
    });
    expect(out.clicks).toBe(0);
    expect(out.orders).toBe(0);
    expect(out.mer).toBe(0);
  });

  it('algebraic identity: MER = (CVR × AOV × (1-r)) / CPC', () => {
    const inputs = {
      spendCents: 750_000,
      cpcCents: 180,
      cvr: 0.025,
      aovCents: 8_500,
      refundRate: 0.07,
      contributionMargin: 0.55,
      fixedCostsCents: 50_000,
    };
    const out = runFunnel(inputs);
    const algebra =
      (inputs.cvr * inputs.aovCents * (1 - inputs.refundRate)) / inputs.cpcCents;
    expect(out.mer).toBeCloseTo(algebra, 1e-9);
  });
});
