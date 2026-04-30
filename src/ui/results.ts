// Results panel renderer for the Monte Carlo tab.

import type { SimResult } from '../math/simulator.js';
import { quantileSorted, expectedShortfall } from '../math/statistics.js';
import { fmtMER, fmtMoneyCents, fmtPercent, fmtNum } from './format.js';

export function renderResults(container: HTMLElement, r: SimResult, targetMER: number, requiredMERValue: number): void {
  container.replaceChildren();

  // HERO ROW
  const hero = document.createElement('div');
  hero.className = 'hero';
  hero.append(
    heroStat('Median MER', fmtMER(r.medianMER), `Target ${fmtMER(targetMER)}`),
    heroStat('P(MER ≥ target)', fmtPercent(r.pHitTarget), confidenceClass(r.pHitTarget)),
    heroStat('P(profit > 0)', fmtPercent(r.pProfitable), confidenceClass(r.pProfitable)),
  );
  container.appendChild(hero);

  // RANGE TABLE
  const table = document.createElement('table');
  table.className = 'range-table';
  table.innerHTML = `
    <thead>
      <tr><th>Metric</th><th>P10</th><th>Median</th><th>P90</th></tr>
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
        <td>CAC</td>
        <td>${fmtMoneyCents(quantileSorted(r.cacCents, 0.1))}</td>
        <td>${fmtMoneyCents(quantileSorted(r.cacCents, 0.5))}</td>
        <td>${fmtMoneyCents(quantileSorted(r.cacCents, 0.9))}</td>
      </tr>
    </tbody>
  `;
  container.appendChild(table);

  // RISK BLOCK
  const risk = document.createElement('div');
  risk.className = 'risk';
  const es = r.expectedShortfallCents;
  risk.innerHTML = `
    <div><strong>Expected shortfall (worst 5%):</strong> ${fmtMoneyCents(es)} mean profit</div>
    <div><strong>Required MER for target profit:</strong> ${fmtMER(requiredMERValue)} <span class="muted">(your median ${fmtMER(r.medianMER)})</span></div>
    <div class="muted">Iterations: ${r.iterations.toLocaleString()}${r.earlyStopped ? ' (early-stopped on convergence)' : ''} · seed: <code>${r.seed}</code></div>
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

function heroStat(label: string, value: string, sub?: string): HTMLElement {
  const el = document.createElement('div');
  el.className = 'hero-stat';
  el.innerHTML = `<div class="label">${escapeHtml(label)}</div><div class="value">${escapeHtml(value)}</div>${
    sub ? `<div class="sub">${escapeHtml(sub)}</div>` : ''
  }`;
  return el;
}

function confidenceClass(p: number): string {
  if (p >= 0.8) return 'High confidence';
  if (p >= 0.5) return 'Moderate';
  return 'Low — risky';
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
