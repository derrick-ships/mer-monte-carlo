# MER Monte Carlo Calculator

A Progressive Web App that calculates Marketing Efficiency Rate (MER), runs probabilistic simulations around it, and answers the operator's actual question: **"what do I need to do to hit my target with X% confidence?"**

This is a decision instrument, not a reporting widget. It exists because public MER calculators (King Kong, ad-tech vendor sites, etc.) hand operators a single point estimate and a slider — which produces false precision. Real campaigns have ranges, and ranges produce probability distributions, not point estimates.

## What makes it different

1. **Distributions, not point estimates.** Every uncertain input is sampled from a properly-shaped distribution (Beta for rates, Lognormal for skewed monetary values, Triangular for gut-feel ranges). Outputs are full distributions over MER, profit, revenue, and CAC.
2. **Probability of hitting target as the hero metric.** "P(MER ≥ target)" is the headline number, not the median. This is what executives actually want to know.
3. **Sensitivity tornado chart.** Pearson correlation of each input with profit, ranked by absolute strength, so you know which input to tighten or invest in.
4. **Reverse calculation.** "What spend gives me 80% confidence of $X profit?" via bisection.
5. **Tightness warnings.** When you enter ranges that look unrealistically narrow, the UI says so. The user's biggest enemy is their own optimism.
6. **Reproducible.** Same inputs + same seed = identical outputs on every device. Share a URL; recipient sees exactly what you saw.
7. **Offline-capable.** PWA installable. Service worker caches everything. No backend, no telemetry, no AI.

## Setup

```bash
npm install
npm run dev      # local dev server at http://localhost:5173
npm run test     # run all unit tests via tsx
npm run build    # production build to dist/
npm run preview  # preview the production build
```

Node 20+ recommended.

## Architecture

```
            ┌──────────────────────────────────────────┐
            │            index.html (shell)            │
            └──────────────────────┬───────────────────┘
                                   │
                                   ▼
            ┌──────────────────────────────────────────┐
            │              src/main.ts                 │
            │  - boots tabs                            │
            │  - owns app state                        │
            │  - sends SimConfig to worker             │
            └──────────────┬─────────────┬─────────────┘
                           │             │
              renders into │             │ posts to
                           ▼             ▼
                ┌─────────────┐   ┌──────────────────────┐
                │  src/ui/*   │   │ workers/             │
                │ inputs      │   │  simulation.worker   │
                │ results     │   └─────────┬────────────┘
                │ histogram   │             │
                │ tornado     │             ▼
                │ tabs        │   ┌──────────────────────┐
                │ format      │   │      src/math/       │
                └──────┬──────┘   │  rng                 │
                       │          │  distributions       │
                       │          │  funnel              │
                       │          │  breakeven           │
                       │          │  simulator           │
                       │          │  statistics          │
                       │          │  sensitivity         │
                       │          │  reverseCalc         │
                       │          │  validation          │
                       │          │  integrity           │
                       │          └──────────────────────┘
                       │
                       ▼
                ┌─────────────┐
                │  src/pwa/*  │  src/state/*  src/styles.css
                │  storage    │  encode       sw.js
                │  register   │  defaults
                └─────────────┘
```

The math kernel is independently testable, framework-free, deterministic, and pure. Everything UI-shaped is a thin projection.

## Formula reference

### Funnel chain (deterministic)

```
Clicks       = Spend / CPC
Orders       = Clicks × CVR
GrossRevenue = Orders × AOV
NetRevenue   = GrossRevenue × (1 - RefundRate)
MER          = NetRevenue / Spend
SpendRate    = 1 / MER
CAC          = Spend / Orders
ContribProfit= NetRevenue × CM - Spend
NetProfit    = ContribProfit - FixedCosts
```

We deliberately persist intermediates rather than collapsing to the algebraic identity `MER = (CVR × AOV × (1 − r)) / CPC` — diagnostics, sensitivity charts, and clean error reporting all need them.

### Break-even and target MER

```
BreakEvenMER       = 1 / CM
BreakEvenMER_fixed = (Spend + Fixed) / (Spend × CM)
RequiredMER        = (Spend + Fixed + TargetProfit) / (Spend × CM)
```

### Distribution sampling

- **Triangular(min, mode, max)** — inverse-CDF with the standard split at `u = (mode-a)/(b-a)`.
- **Lognormal(mean, sd)** — derive `σ² = ln(1 + s²/m²)`, `μ = ln(m) − σ²/2`, then `X = exp(μ + σZ)` with `Z ~ N(0,1)` from Box-Muller.
- **Beta(mean, sd)** — convert to `(α, β)` via the standard moment-matching formula, sample `Gamma(α)/(Gamma(α)+Gamma(β))` using Marsaglia–Tsang. Reject when `sd ≥ √(p(1−p))`.

### RNG

xoshiro256\*\* with SplitMix64 seeding. Period 2²⁵⁶. Implementation uses BigInt for correctness. See [`src/math/rng.ts`](src/math/rng.ts).

### Simulation

- N = 10,000 / 50,000 (default) / 100,000 / 200,000 iterations.
- Welford streaming statistics for mean and variance.
- Full sample arrays preserved for percentile + sensitivity.
- Convergence early-stop when `SE(mean MER) / |mean MER| < 1%` after a 5,000-iteration floor.
- Output integrity checks (quantile ordering, probability self-consistency, finite-ness, convergence).

### Sources

- Marsaglia, G., & Tsang, W. W. (2000). *A Simple Method for Generating Gamma Variables.* ACM TOMS 26(3).
- Welford, B. P. (1962). *Note on a method for calculating corrected sums of squares and products.* Technometrics 4(3).
- Vigna, S. (2019). *xoshiro/xoroshiro generators and the PRNG shootout.* https://prng.di.unimi.it/
- Hyndman, R. J., & Fan, Y. (1996). *Sample Quantiles in Statistical Packages.* The American Statistician.

## Distribution choice rationale

We use **Beta** for any bounded rate (CTR, CVR, contribution margin, refund rate) because it has support on `(0,1)` and can be parameterized by mean and SD with a clean validity check.

We use **Lognormal** for any strictly-positive monetary value with right-skewed reality (CPC, AOV, LTV) because the alternative — Normal — will sample negative or near-zero values that make no sense for prices.

We use **Triangular** for gut-feel min/likely/max inputs because it's the right tool for "I don't know the distribution; I just have a low, central, and high estimate."

We **never** use Normal. Normal will sample impossible values, and the only remediation — clipping at zero or one — silently distorts your distribution. If you need a bell-shape, pick the right bounded distribution.

## Known limitations (v1)

- **Inputs assumed independent.** Real conversion rate and refund rate are correlated; we do not model that. Adding copulas or multivariate sampling is on the v2 roadmap.
- **MER is independent of Spend in the current funnel model.** This is true by algebraic identity (`MER = CVR × AOV × (1−r) / CPC`). The reverse-calc tool therefore searches for spend at confidence on **profit**, not on MER. The UI labels this clearly.
- **No diminishing-returns curve.** v1 assumes constant CPC and CVR over the entire spend range. Real campaigns bend.
- **Continuous order model.** Orders are computed as `Clicks × CVR`, treating a fractional order as meaningful. Fine for budgets above ~$1k/day where order counts are large; below that, a Binomial/Poisson model would be more honest.
- **Channel decomposition not modeled.** The calculator runs at the campaign-aggregate level. Real operators allocate budget across channels with different distributions. v2 territory.
- **LTV and post-purchase economics not modeled.** First-order MER only.

## Contributing

The math kernel is the most-reviewed area. If you change it, you must also update tests; we target 100% branch coverage on `/math`. UI changes are welcome but should not require math kernel changes — if they do, surface the reason in the PR description.

## License

MIT.
