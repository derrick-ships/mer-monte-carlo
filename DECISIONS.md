# Decisions log

Tradeoffs we made and why. Read this before reviewing math changes.

## Beta / Lognormal / Triangular instead of Normal

**Decision:** Refuse to expose Normal as a distribution choice in the UI.

**Why:** Normal has support over the entire real line. Sampling Normal for CPC will produce negative CPCs; Normal for CVR will produce CVRs greater than 1. The only mitigations are (a) clipping or (b) rejection sampling, both of which silently distort your sampled distribution from what the user thought they specified. We picked the right distribution for each variable type instead. Beta is the canonical bounded distribution; Lognormal is the canonical strictly-positive right-skewed distribution; Triangular is the canonical gut-feel range.

**Alternative considered:** truncated Normal. Rejected: increases code complexity, distorts moments unpredictably as truncation gets close to the mean, doesn't correspond to any real-world distribution operators have intuition for.

## Median, not mean, as the headline statistic

**Decision:** "Median MER" is the hero number in the results panel.

**Why:** MER is a ratio (Revenue / Spend). For ratio distributions, the mean is biased upward by Jensen's inequality. The median is the right central-tendency estimator for "what's the typical outcome?" — which is the question the operator is asking. We display the mean elsewhere for completeness, but it's never headline.

## Welford streaming statistics

**Decision:** All running mean/variance computations use Welford's online algorithm.

**Why:** At 200,000 samples, the naive `Σx²/N − (Σx/N)²` formula loses 4–5 significant digits to catastrophic cancellation. Welford's update is numerically stable: subsequent updates depend only on the most recent estimate, not on accumulated raw sums. The cost is one extra subtraction per sample — negligible.

## xoshiro256\*\* + SplitMix64 seeding

**Decision:** xoshiro256\*\* implemented in BigInt, seeded by SplitMix64 from a string-or-uint64 seed.

**Why:**
- Period 2²⁵⁶, vastly exceeds the ~2⁵³ doubles we'll ever sample.
- Passes BigCrush. No known statistical defects in any output bit position.
- Native 64-bit output produces bias-free `[0,1)` doubles via `(u64 >> 11) / 2⁵³`.
- BigInt makes the implementation line-for-line equivalent to Vigna's reference C — the alternative (manual Uint32-pair emulation) has been a recurring source of off-by-one and rotation bugs in published JS ports.

**Cost:** BigInt is ~5× slower than Uint32. For our workload (50k iterations × ~10 RNG draws = 500k draws), that's ~150ms in a Web Worker. Fine.

**Alternative considered:** Math.random. Rejected: not seedable, not reproducible across runs.

**Alternative considered:** SplitMix64 alone as the production RNG. Rejected: period 2⁶⁴ ≈ 1.8 × 10¹⁹ is enough for any single run, but SplitMix64's known weak avalanche on the low bits has been seen to bias product distributions. xoshiro256\*\* has no such caveats.

## Vite + vanilla TS, no React

**Decision:** No framework dependency. Hand-rolled DOM manipulation.

**Why:** The app has ~5 stateful screens, no routing, no animations beyond chart redraws. React/Vue would add ~50kb gzipped + a build cost for zero functional benefit. Bundle size goal is < 80kb gzipped main bundle; with React we couldn't hit that with the math kernel and worker also included. Auditability is also higher with vanilla — every DOM update is in plain sight.

**Cost:** UI code is more verbose. Acceptable trade for a calculator with no need for a component library.

## Integer cents internally

**Decision:** All monetary state is stored as integer cents (or float cents for sample arrays). Conversion to dollars happens only at the UI rendering boundary.

**Why:** Floating-point dollars are a real bug source — `0.1 + 0.2 ≠ 0.3` makes `5.10 + 0.20` display as `5.30` but compare unequal. Integer cents are exact for any monetary input the user types. We accept that simulation samples are float cents (the underlying distributions are continuous), but inputs and reportable totals are exact.

## Web Worker for simulation

**Decision:** All `runSimulation` calls happen in a Web Worker.

**Why:** A 200k-iteration simulation with BigInt RNG takes ~3 seconds. On the main thread, that freezes scrolling, blocks input, and stalls the rAF loop. In a worker, the UI stays responsive and we can show a "Running…" state without jank.

**Cost:** Slight serialization overhead (a few hundred microseconds for the SimConfig). Marked the result Float64Arrays as transferable, so the result transfer is zero-copy.

## Convergence-based early stop

**Decision:** Stop simulating when `SE(mean MER) / |mean MER| < 1%`, after a 5,000-iteration floor.

**Why:** Most realistic scenarios converge in 10k–25k iterations; running another 175k just to hit the user's "200k" choice is wasted compute on a phone CPU. Capping based on actual convergence (rather than a fixed N) is what real Monte Carlo libraries do.

**Cost:** Slightly different sample counts run-to-run if inputs change. We surface the actual count and an "early-stopped" badge so users can audit it.

## Output integrity checks

**Decision:** After every simulation, run four checksums and surface failures in-UI.

**Why:** False confidence is the failure mode we're protecting against. A pretty histogram drawn over a corrupt sort, or a "P(target) = 0.85" computed against a stale array, is worse than no answer. Failing loudly makes regressions obvious.

**Cost:** ~5ms per simulation for the checks. Trivial.

## Deferred to v2

| Feature | Why deferred |
|---|---|
| Input correlation modeling (copulas, factor models) | Independence assumption is conservative for v1; correlations require operators to estimate them, which adds friction. v2 should let users specify pairwise correlations. |
| Diminishing-returns curve on Spend | Requires either a parametric curve (e.g., Hill) or a calibration UI; both expand scope. v1 explicitly says "MER is independent of Spend" and we lean into that. |
| Channel decomposition | Multi-channel allocation needs a constraint solver; out of scope. |
| LTV / cohort economics | Forward-looking metrics need a discount-rate UI and assumption set. |
| Poisson/Binomial discrete order model | Continuous model breaks down below ~$1k/day; we documented the limitation. |
| Markov / multi-touch attribution | The whole point of MER is that it sidesteps attribution — adding attribution back negates the simplicity. |
| Real PWA icons | We ship an embedded SVG data-URI placeholder. Real production deploy should swap to PNG icons at proper sizes. |

## Floating-point determinism caveat

**Observation:** JavaScript engines do not guarantee bit-exact transcendentals (`Math.log`, `Math.exp`, `Math.cos`). V8, SpiderMonkey, and JavaScriptCore all use FDLIBM-equivalent implementations and produce identical results in practice, but the spec only requires correctly-rounded basic operations.

**Implication:** Across modern browser versions, our outputs are bit-identical for the same seed. Across exotic engines or hand-rolled JS runtimes, last-bit differences in `Math.log` may produce last-bit differences in samples. Statistical outputs (medians, p-values) are unaffected at any practical precision.

**Mitigation:** None planned. Shipping our own log/exp implementations would be ~200 lines of carefully-tested code for last-bit determinism nobody asked for. Documented and moved on.
