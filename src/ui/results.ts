// Results panel renderer for the Monte Carlo tab. Every metric is paired
// with a plain-English caption so a reader who has never run a Monte Carlo
// simulation can still read the page top-to-bottom.

import type { SimResult } from '../math/simulator.js';
import { quantileSorted } from '../math/statistics.js';
import { fmtMER, fmtMoneyCents, fmtPercent } from './format.js';
import { GLOSSARY } from './glossary.js';

export function renderResults(
  container: HTMLElement,
  r: SimResult,
  targetMER: number,
  requiredMERValue: number,
): void {
  container.replaceChildren();

  // Section heading
  const head = document.createElement('div');
  head.className = 'section-head';
  head.innerHTML = `
    <h2>Result</h2>
    <span class="meta">${r.iterations.toLocaleString()} runs · seed ${escapeHtml(r.seed)}${r.earlyStopped ? ' · converged early' : ''}</span>
  `;
  container.appendChild(head);

  // HERO ROW
  const hero = document.createElement('div');
  hero.className = 'hero';
  hero.append(
    heroStat({
      label: 'Probability of hitting target',
      value: fmtPercent(r.pHitTarget),
      sub: `Target ${fmtMER(targetMER)}  ·  ${confidenceClass(r.pHitTarget)}`,
      def: GLOSSARY.pHitTarget.short,
      accent: true,
    }),
    heroStat({
      label: 'Median MER',
      value: fmtMER(r.medianMER),
      sub: 'Half of futures above; half below.',
      def: GLOSSARY.medianMER.short,
    }),
    heroStat({
      label: 'Probability of profit',
      value: fmtPercent(r.pProfitable),
      sub: confidenceClass(r.pProfitable),
      def: GLOSSARY.pProfitable.short,
    }),
  );
  container.appendChild(hero);

  // RANGE TABLE
  const wrap = document.createElement('div');
  wrap.className = 'chart-block';
  wrap.innerHTML = `
    <h3>Range across all futures</h3>
    <p>${GLOSSARY.p10p90.short}</p>
  `;
  const table = document.createElement('table');
  table.className = 'range-table';
  table.innerHTML = `
    <thead>
      <tr><th>Metric</th><th>P10 (worst case)</th><th>Median</th><th>P90 (best case)</th></tr>
    </thead>
    <tbody>
      <tr>
        <td>MER</td>
        <td>${fmtMER(quantileSorted(r.mer, 0.1))}</td>
        <td>${fmtMER(quantileSorted(r.mer, 0.5))}</td>
        <td>${fmtMER(quantileSorted(r.mer, 0.9))}</td>
      </tr>
      <tr>
        <td>Net profit</td>
        <td>${fmtMoneyCents(quantileSorted(r.netProfitCents, 0.1))}</td>
        <td>${fmtMoneyCents(quantileSorted(r.netProfitCents, 0.5))}</td>
        <td>${fmtMoneyCents(quantileSorted(r.netProfitCents, 0.9))}</td>
      </tr>
      <tr>
        <td>Net revenue</td>
        <td>${fmtMoneyCents(quantileSorted(r.netRevenueCents, 0.1))}</td>
        <td>${fmtMoneyCents(quantileSorted(r.netRevenueCents, 0.5))}</td>
        <td>${fmtMoneyCents(quantileSorted(r.netRevenueCents, 0.9))}</td>
      </tr>
      <tr>
        <td>CAC (cost per customer)</td>
        <td>${fmtMoneyCents(quantileSorted(r.cacCents, 0.1))}</td>
        <td>${fmtMoneyCents(quantileSorted(r.cacCents, 0.5))}</td>
        <td>${fmtMoneyCents(quantileSorted(r.cacCents, 0.9))}</td>
      </tr>
    </tbody>
  `;
  wrap.appendChild(table);
  container.appendChild(wrap);

  // RISK BLOCK
  const risk = document.createElement('div');
  risk.className = 'risk';
  const es = r.expectedShortfallCents;
  risk.innerHTML = `
    <div class="row">
      <div>
        <div>Expected shortfall <span class="muted">(worst 5% of futures)</span></div>
        <div class="def">${escapeHtml(GLOSSARY.expectedShortfall.short)}</div>
      </div>
      <div class="v">${fmtMoneyCents(es)}</div>
    </div>
    <div class="row">
      <div>
        <div>Required MER for target profit</div>
        <div class="def">${escapeHtml(GLOSSARY.requiredMER.short)}</div>
      </div>
      <div class="v ${r.medianMER >= requiredMERValue ? 'accent' : ''}">${fmtMER(requiredMERValue)} <span class="muted">vs. median ${fmtMER(r.medianMER)}</span></div>
    </div>
    <div class="seedline">
      ${r.iterations.toLocaleString()} ITERATIONS${r.earlyStopped ? ' · CONVERGED EARLY' : ''} · SEED <code>${escapeHtml(r.seed)}</code>
    </div>
  `;
  container.appendChild(risk);

  // INTEGRITY
  if (!r.integrity.ok) {
    const warn = document.createElement('div');
    warn.className = 'integrity-warn';
    warn.innerHTML = `<strong>Integrity check warnings:</strong><ul>${r.integrity.failures
      .map((f) => `<li>${escapeHtml(f)}</li>`)
      .join('')}</ul>`;
    container.appendChild(warn);
  }
}

function heroStat(o: {
  label: string;
  value: string;
  sub?: string;
  def?: string;
  accent?: boolean;
}): HTMLElement {
  const el = document.createElement('div');
  el.className = 'hero-stat';
  el.innerHTML = `
    <div class="label">${escapeHtml(o.label)}</div>
    <div class="value${o.accent ? ' accent' : ''}">${escapeHtml(o.value)}</div>
    ${o.sub ? `<div class="sub">${escapeHtml(o.sub)}</div>` : ''}
    ${o.def ? `<div class="def">${escapeHtml(o.def)}</div>` : ''}
  `;
  return el;
}

function confidenceClass(p: number): string {
  if (p >= 0.8) return 'High confidence';
  if (p >= 0.5) return 'Moderate — proceed carefully';
  return 'Low — risky';
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
