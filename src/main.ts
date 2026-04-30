// Application entry point. Wires the UI, persistence, and worker together.
//
// Architecture:
//   main.ts owns app state and orchestrates UI re-renders.
//   The Monte Carlo simulation runs in a Web Worker; main.ts posts a SimConfig
//   and receives a SimResult. Math is pure; UI is a thin projection layer.

import {
  PRESETS,
  DEFAULT_PRESET_ID,
} from './state/defaults.js';
import type { Preset } from './state/defaults.js';
import { encodeStateToHash, decodeStateFromHash } from './state/encode.js';
import type { SimConfig, SimResult, DistSpec } from './math/simulator.js';
import { runFunnel } from './math/funnel.js';
import {
  breakEvenMER,
  breakEvenMERWithFixed,
  requiredMER,
} from './math/breakeven.js';
import { setupTabs } from './ui/tabs.js';
import { renderResults } from './ui/results.js';
import { drawHistogram } from './ui/histogram.js';
import { drawTornado } from './ui/tornado.js';
import {
  renderDistField,
  renderNumericInput,
  FUNNEL_FIELDS,
  affixesFor,
} from './ui/inputs.js';
import { GLOSSARY } from './ui/glossary.js';
import { fmtMER, fmtMoneyCents, fmtMoneyCentsPrecise, fmtPercent, dollarsToCents } from './ui/format.js';
import { registerServiceWorker } from './pwa/register-sw.js';
import {
  saveScenario,
  listScenarios,
  deleteScenario,
  incrementVisitCount,
  type StoredScenario,
} from './pwa/storage.js';

type AppState = {
  cfg: SimConfig;
  lastResult: SimResult | null;
};

// Convert a Preset into a SimConfig (cents in, sane defaults out).
function presetToConfig(p: Preset, seed = 'default'): SimConfig {
  return {
    spend: p.spend,
    cpc: p.cpc,
    cvr: p.cvr,
    aov: p.aov,
    refundRate: p.refundRate,
    contributionMargin: p.contributionMargin,
    fixedCosts: p.fixedCosts,
    targetMER: p.targetMER,
    targetProfitCents: p.targetProfitCents,
    iterations: 50_000,
    seed,
    earlyStop: true,
  };
}

const state: AppState = {
  cfg: presetToConfig(PRESETS.find((p) => p.id === DEFAULT_PRESET_ID)!),
  lastResult: null,
};

// Restore from URL hash if present.
const restored = decodeStateFromHash(location.hash);
if (restored) state.cfg = restored;

// ---------- Helpers ----------
function sectionHead(parent: HTMLElement, title: string, lede: string, meta: string): void {
  const head = document.createElement('div');
  head.className = 'section-head';
  head.innerHTML = `
    <h2>${escapeHtml(title)}</h2>
    <span class="meta">${escapeHtml(meta)}</span>
  `;
  parent.appendChild(head);
  if (lede) {
    const p = document.createElement('p');
    p.className = 'section-lede';
    p.textContent = lede;
    parent.appendChild(p);
  }
}

// ---------- Quick MER tab ----------
function renderQuickTab(root: HTMLElement): void {
  root.replaceChildren();

  sectionHead(
    root,
    'Quick MER',
    'A point estimate. Type your numbers and see your current efficiency, your break-even, and the MER you would need to clear a profit target. No simulation — just the formulas.',
    '01 / POINT ESTIMATE',
  );

  const inputs = document.createElement('div');
  inputs.className = 'inputs';
  root.appendChild(inputs);

  const local = {
    revenueDollars: 100_000,
    spendDollars: 25_000,
    cm: 0.6,
    fixedDollars: 5_000,
    targetProfitDollars: 10_000,
  };

  const out = document.createElement('div');
  out.className = 'quick-out';
  root.appendChild(out);

  function recompute(): void {
    const revenueCents = dollarsToCents(local.revenueDollars);
    const spendCents = dollarsToCents(local.spendDollars);
    const fixedCents = dollarsToCents(local.fixedDollars);
    const targetCents = dollarsToCents(local.targetProfitDollars);
    const mer = spendCents > 0 ? revenueCents / spendCents : 0;
    const spendRate = revenueCents > 0 ? spendCents / revenueCents : Infinity;
    const contribProfit = revenueCents * local.cm - spendCents;
    const netProfit = contribProfit - fixedCents;
    let beMER = 0;
    let beMERFixed = 0;
    let reqMER = 0;
    try {
      beMER = breakEvenMER(local.cm);
      beMERFixed = breakEvenMERWithFixed(spendCents, fixedCents, local.cm);
      reqMER = requiredMER(spendCents, fixedCents, targetCents, local.cm);
    } catch (_e) {
      // leave as 0; UI will show "—"
    }
    out.innerHTML = `
      <div class="hero">
        <div class="hero-stat">
          <div class="label">Current MER</div>
          <div class="value accent">${fmtMER(mer)}</div>
          <div class="def">${escapeHtml(GLOSSARY.mer.short)}</div>
        </div>
        <div class="hero-stat">
          <div class="label">Spend rate</div>
          <div class="value">${fmtPercent(spendRate)}</div>
          <div class="def">${escapeHtml(GLOSSARY.spendRate.short)}</div>
        </div>
        <div class="hero-stat">
          <div class="label">Net profit</div>
          <div class="value">${fmtMoneyCentsPrecise(netProfit)}</div>
          <div class="def">${escapeHtml(GLOSSARY.netProfit.short)}</div>
        </div>
      </div>
      <div class="chart-block">
        <h3>Break-evens and required MER</h3>
        <p>The minimum MER you need to cover costs (break-even) and the MER you would need to clear your target profit.</p>
        <table class="range-table">
          <tbody>
            <tr><td>Contribution profit <span class="muted">(after product cost)</span></td><td>${fmtMoneyCentsPrecise(contribProfit)}</td></tr>
            <tr><td>Break-even MER <span class="muted">(margin only)</span></td><td>${fmtMER(beMER)}</td></tr>
            <tr><td>Break-even MER <span class="muted">(with fixed costs)</span></td><td>${fmtMER(beMERFixed)}</td></tr>
            <tr><td>Required MER for target profit</td><td>${fmtMER(reqMER)}</td></tr>
          </tbody>
        </table>
      </div>
    `;
  }

  renderNumericInput(inputs, 'q-rev', 'Net revenue', local.revenueDollars, (v) => {
    local.revenueDollars = v;
    recompute();
  }, {
    glossaryKey: 'netRevenue',
    affix: { prefix: '$', suffix: 'USD' },
  });
  renderNumericInput(inputs, 'q-spend', 'Ad spend', local.spendDollars, (v) => {
    local.spendDollars = v;
    recompute();
  }, {
    glossaryKey: 'spend',
    affix: { prefix: '$', suffix: 'USD' },
  });
  renderNumericInput(inputs, 'q-cm', 'Contribution margin', local.cm, (v) => {
    local.cm = v;
    recompute();
  }, {
    glossaryKey: 'contributionMargin',
    affix: { suffix: '0–1' },
  });
  renderNumericInput(inputs, 'q-fixed', 'Fixed costs', local.fixedDollars, (v) => {
    local.fixedDollars = v;
    recompute();
  }, {
    glossaryKey: 'fixedCosts',
    affix: { prefix: '$', suffix: 'USD' },
  });
  renderNumericInput(inputs, 'q-target', 'Target profit', local.targetProfitDollars, (v) => {
    local.targetProfitDollars = v;
    recompute();
  }, {
    glossaryKey: 'targetProfit',
    affix: { prefix: '$', suffix: 'USD' },
  });

  recompute();
}

// ---------- Funnel tab ----------
function renderFunnelTab(root: HTMLElement): void {
  root.replaceChildren();

  sectionHead(
    root,
    'Funnel',
    'A deterministic walk through the funnel: spend buys clicks, clicks convert, orders generate revenue. Useful for sanity-checking a single scenario before turning it into a Monte Carlo.',
    '02 / FUNNEL CHAIN',
  );

  const inputs = document.createElement('div');
  inputs.className = 'inputs';
  root.appendChild(inputs);

  // Local cents-based state.
  const f = {
    spendCents: 5_000_00,
    cpcCents: 250,
    cvr: 0.04,
    aovCents: 15_000,
    refundRate: 0.05,
    contributionMargin: 0.6,
    fixedCostsCents: 1_000_00,
    targetProfitCents: 1_000_00,
  };

  const out = document.createElement('div');
  out.className = 'funnel-out';
  root.appendChild(out);

  function recompute(): void {
    const r = runFunnel(f);
    let beMER = 0;
    let beMERFixed = 0;
    let reqMER = 0;
    try {
      beMER = breakEvenMER(f.contributionMargin);
      beMERFixed = breakEvenMERWithFixed(f.spendCents, f.fixedCostsCents, f.contributionMargin);
      reqMER = requiredMER(f.spendCents, f.fixedCostsCents, f.targetProfitCents, f.contributionMargin);
    } catch (_e) { /* swallow */ }
    out.innerHTML = `
      <div class="hero">
        <div class="hero-stat">
          <div class="label">MER</div>
          <div class="value accent">${fmtMER(r.mer)}</div>
          <div class="def">${escapeHtml(GLOSSARY.mer.short)}</div>
        </div>
        <div class="hero-stat">
          <div class="label">Net profit</div>
          <div class="value">${fmtMoneyCents(r.netProfitCents)}</div>
          <div class="def">${escapeHtml(GLOSSARY.netProfit.short)}</div>
        </div>
        <div class="hero-stat">
          <div class="label">CAC</div>
          <div class="value">${r.cacCents == null ? '—' : fmtMoneyCents(r.cacCents)}</div>
          <div class="def">${escapeHtml(GLOSSARY.cac.short)}</div>
        </div>
      </div>
      <div class="chart-block">
        <h3>Funnel chain</h3>
        <p>Each row follows from the row above. If something looks off, work backwards from the suspicious number.</p>
        <table class="range-table">
          <tbody>
            <tr><td>Clicks</td><td>${r.clicks.toFixed(0)}</td></tr>
            <tr><td>Orders</td><td>${r.orders.toFixed(1)}</td></tr>
            <tr><td>Gross revenue <span class="muted">(before refunds)</span></td><td>${fmtMoneyCents(r.grossRevenueCents)}</td></tr>
            <tr><td>Net revenue <span class="muted">(after refunds)</span></td><td>${fmtMoneyCents(r.netRevenueCents)}</td></tr>
            <tr><td>Contribution profit <span class="muted">(after product cost)</span></td><td>${fmtMoneyCents(r.contribProfitCents)}</td></tr>
            <tr><td>Break-even MER</td><td>${fmtMER(beMER)}</td></tr>
            <tr><td>Break-even MER <span class="muted">(with fixed costs)</span></td><td>${fmtMER(beMERFixed)}</td></tr>
            <tr><td>Required MER for target profit</td><td>${fmtMER(reqMER)}</td></tr>
          </tbody>
        </table>
        <p class="muted" style="font-family: var(--font-mono); font-size: 11px; letter-spacing: 0.04em;">
          Identity check: MER = (CVR × AOV × (1 − refund)) / CPC = ${fmtMER(
            (f.cvr * f.aovCents * (1 - f.refundRate)) / f.cpcCents,
          )}
        </p>
      </div>
    `;
  }

  // Input row: dollars/decimals on the surface; cents under the hood.
  renderNumericInput(inputs, 'f-spend', 'Ad spend', f.spendCents / 100, (v) => { f.spendCents = dollarsToCents(v); recompute(); },
    { glossaryKey: 'spend', affix: affixesFor('money') });
  renderNumericInput(inputs, 'f-cpc', 'Cost per click', f.cpcCents / 100, (v) => { f.cpcCents = dollarsToCents(v); recompute(); },
    { glossaryKey: 'cpc', affix: affixesFor('money') });
  renderNumericInput(inputs, 'f-cvr', 'Conversion rate', f.cvr, (v) => { f.cvr = v; recompute(); },
    { glossaryKey: 'cvr', affix: affixesFor('rate') });
  renderNumericInput(inputs, 'f-aov', 'Average order value', f.aovCents / 100, (v) => { f.aovCents = dollarsToCents(v); recompute(); },
    { glossaryKey: 'aov', affix: affixesFor('money') });
  renderNumericInput(inputs, 'f-refund', 'Refund rate', f.refundRate, (v) => { f.refundRate = v; recompute(); },
    { glossaryKey: 'refundRate', affix: affixesFor('rate') });
  renderNumericInput(inputs, 'f-cm', 'Contribution margin', f.contributionMargin, (v) => { f.contributionMargin = v; recompute(); },
    { glossaryKey: 'contributionMargin', affix: affixesFor('rate') });
  renderNumericInput(inputs, 'f-fixed', 'Fixed costs', f.fixedCostsCents / 100, (v) => { f.fixedCostsCents = dollarsToCents(v); recompute(); },
    { glossaryKey: 'fixedCosts', affix: affixesFor('money') });
  renderNumericInput(inputs, 'f-target', 'Target profit', f.targetProfitCents / 100, (v) => { f.targetProfitCents = dollarsToCents(v); recompute(); },
    { glossaryKey: 'targetProfit', affix: affixesFor('money') });

  recompute();
}

// ---------- Monte Carlo tab ----------
function renderMonteCarloTab(root: HTMLElement): void {
  root.replaceChildren();

  sectionHead(
    root,
    'Monte Carlo',
    'Tell the simulator a range for each uncertain input and it runs thousands of possible futures. The headline is not the average — it is your probability of clearing your target.',
    '03 / DISTRIBUTIONS',
  );

  const inputsWrap = document.createElement('div');
  inputsWrap.className = 'inputs';
  root.appendChild(inputsWrap);

  // Preset selector — full field
  const presetWrap = document.createElement('label');
  presetWrap.className = 'field';
  const presetLabel = document.createElement('span');
  presetLabel.className = 'field-label';
  presetLabel.textContent = 'Industry preset';
  presetWrap.appendChild(presetLabel);
  const presetDef = document.createElement('p');
  presetDef.className = 'field-def';
  presetDef.textContent = 'Pre-tuned starting points by channel and category. Pick one near your business, then adjust.';
  presetWrap.appendChild(presetDef);
  const presetShell = document.createElement('div');
  presetShell.className = 'input-shell';
  presetShell.style.gridTemplateColumns = '1fr';
  const presetSelect = document.createElement('select');
  presetSelect.style.width = '100%';
  presetSelect.style.border = '0';
  presetSelect.style.background = 'transparent';
  presetSelect.style.color = 'inherit';
  presetSelect.style.font = 'inherit';
  presetSelect.style.padding = '10px 12px';
  for (const p of PRESETS) {
    const o = document.createElement('option');
    o.value = p.id;
    o.textContent = p.label;
    presetSelect.appendChild(o);
  }
  presetSelect.addEventListener('change', () => {
    const p = PRESETS.find((x) => x.id === presetSelect.value);
    if (p) {
      state.cfg = presetToConfig(p, state.cfg.seed);
      renderMonteCarloTab(root);
    }
  });
  presetShell.appendChild(presetSelect);
  presetWrap.appendChild(presetShell);
  inputsWrap.appendChild(presetWrap);

  // Distribution fields
  for (const field of FUNNEL_FIELDS) {
    const fieldId = field.id as keyof Pick<
      SimConfig,
      'spend' | 'cpc' | 'cvr' | 'aov' | 'refundRate' | 'contributionMargin' | 'fixedCosts'
    >;
    renderDistField(inputsWrap, field, state.cfg[fieldId], (spec: DistSpec) => {
      (state.cfg as unknown as Record<string, DistSpec>)[fieldId] = spec;
    });
  }

  renderNumericInput(inputsWrap, 'mc-target', 'Target MER', state.cfg.targetMER, (v) => { state.cfg.targetMER = v; },
    { glossaryKey: 'targetMER', affix: affixesFor('mer') });
  renderNumericInput(inputsWrap, 'mc-tprofit', 'Target profit', state.cfg.targetProfitCents / 100, (v) => { state.cfg.targetProfitCents = dollarsToCents(v); },
    { glossaryKey: 'targetProfit', affix: affixesFor('money') });

  // Iterations as a select dressed up like our other shells
  const iterWrap = document.createElement('label');
  iterWrap.className = 'field';
  const iterLabel = document.createElement('span');
  iterLabel.className = 'field-label';
  iterLabel.textContent = 'Iterations';
  iterWrap.appendChild(iterLabel);
  const iterDef = document.createElement('p');
  iterDef.className = 'field-def';
  iterDef.textContent = GLOSSARY.iterations.short;
  iterWrap.appendChild(iterDef);
  const iterMeta = document.createElement('small');
  iterMeta.className = 'field-meta';
  iterMeta.textContent = `e.g., ${GLOSSARY.iterations.example ?? ''}`;
  iterWrap.appendChild(iterMeta);
  const iterShell = document.createElement('div');
  iterShell.className = 'input-shell';
  iterShell.style.gridTemplateColumns = '1fr auto';
  const iterSel = document.createElement('select');
  iterSel.style.border = '0';
  iterSel.style.background = 'transparent';
  iterSel.style.color = 'inherit';
  iterSel.style.font = 'inherit';
  iterSel.style.fontFamily = 'var(--font-mono)';
  iterSel.style.padding = '10px 12px';
  for (const n of [10_000, 50_000, 100_000, 200_000]) {
    const o = document.createElement('option');
    o.value = String(n);
    o.textContent = n.toLocaleString();
    iterSel.appendChild(o);
  }
  iterSel.value = String(state.cfg.iterations);
  iterSel.addEventListener('change', () => {
    state.cfg.iterations = parseInt(iterSel.value, 10);
  });
  iterShell.appendChild(iterSel);
  const iterAffix = document.createElement('span');
  iterAffix.className = 'affix suffix';
  iterAffix.textContent = 'RUNS';
  iterShell.appendChild(iterAffix);
  iterWrap.appendChild(iterShell);
  inputsWrap.appendChild(iterWrap);

  // Seed input
  renderNumericInput(
    inputsWrap,
    'mc-seed',
    'Seed',
    parseInt(state.cfg.seed.replace(/\D/g, '')) || 1,
    (v) => { state.cfg.seed = String(v); },
    { glossaryKey: 'seed', affix: affixesFor('seed') },
  );

  // Action row
  const actions = document.createElement('div');
  actions.className = 'actions';
  inputsWrap.appendChild(actions);

  const runBtn = document.createElement('button');
  runBtn.textContent = 'Run simulation';
  runBtn.className = 'primary';
  actions.appendChild(runBtn);

  const shareBtn = document.createElement('button');
  shareBtn.textContent = 'Copy share link';
  actions.appendChild(shareBtn);

  const saveBtn = document.createElement('button');
  saveBtn.textContent = 'Save scenario';
  actions.appendChild(saveBtn);

  const kbdHint = document.createElement('span');
  kbdHint.className = 'meta';
  kbdHint.style.marginLeft = 'auto';
  kbdHint.innerHTML = '<span class="kbd">Enter</span> next tab · <span class="kbd">Esc</span> back';
  actions.appendChild(kbdHint);

  // Output area
  const resultsEl = document.createElement('div');
  resultsEl.id = 'mc-results';
  root.appendChild(resultsEl);

  const histCanvas = document.createElement('canvas');
  histCanvas.className = 'chart';
  histCanvas.style.height = '260px';
  histCanvas.style.width = '100%';

  const tornadoCanvas = document.createElement('canvas');
  tornadoCanvas.className = 'chart';
  tornadoCanvas.style.height = '240px';
  tornadoCanvas.style.width = '100%';

  // Worker — lazy create on first run.
  let worker: Worker | null = null;
  function getWorker(): Worker {
    if (!worker) {
      worker = new Worker(new URL('./workers/simulation.worker.ts', import.meta.url), { type: 'module' });
    }
    return worker;
  }

  runBtn.addEventListener('click', () => {
    runBtn.disabled = true;
    runBtn.textContent = 'Running…';
    const w = getWorker();
    const id = String(Math.random()).slice(2);
    const handler = (e: MessageEvent): void => {
      const msg = e.data as { id: string; type: string };
      if (msg.id !== id) return;
      if (msg.type === 'result') {
        const result = (msg as unknown as { result: SimResult }).result;
        state.lastResult = result;
        renderResults(resultsEl, result, state.cfg.targetMER, requiredMERSafe());

        // Histogram block
        const histBlock = document.createElement('div');
        histBlock.className = 'chart-block';
        histBlock.innerHTML = `
          <h3>Distribution of MER outcomes</h3>
          <p>Each bar counts how many simulated futures landed in that range. The dashed line marks your target.</p>
        `;
        histBlock.appendChild(histCanvas);
        resultsEl.appendChild(histBlock);

        // Tornado block
        const tornadoBlock = document.createElement('div');
        tornadoBlock.className = 'chart-block';
        tornadoBlock.innerHTML = `
          <h3>Sensitivity — which input matters most</h3>
          <p>${escapeHtml(GLOSSARY.tornado.short)}</p>
        `;
        tornadoBlock.appendChild(tornadoCanvas);
        resultsEl.appendChild(tornadoBlock);

        drawHistogram({
          canvas: histCanvas,
          data: result.mer,
          threshold: state.cfg.targetMER,
          thresholdLabel: `Target ${fmtMER(state.cfg.targetMER)}`,
          axisLabel: 'MER',
          color: getCssVar('--fg'),
          thresholdColor: getCssVar('--accent'),
        });
        drawTornado({
          canvas: tornadoCanvas,
          rows: result.tornado,
          posColor: getCssVar('--accent'),
          negColor: getCssVar('--fg'),
        });

        runBtn.disabled = false;
        runBtn.textContent = 'Run simulation';
        w.removeEventListener('message', handler);
      } else if (msg.type === 'error') {
        const err = (msg as unknown as { error: string }).error;
        resultsEl.innerHTML = `<div class="integrity-warn"><strong>Simulation failed.</strong><div>${escapeHtml(err)}</div></div>`;
        runBtn.disabled = false;
        runBtn.textContent = 'Run simulation';
        w.removeEventListener('message', handler);
      }
    };
    w.addEventListener('message', handler);
    w.postMessage({ id, type: 'run', cfg: state.cfg });
  });

  shareBtn.addEventListener('click', async () => {
    const hash = encodeStateToHash(state.cfg);
    const url = location.origin + location.pathname + hash;
    try {
      await navigator.clipboard.writeText(url);
      shareBtn.textContent = 'Link copied';
      setTimeout(() => (shareBtn.textContent = 'Copy share link'), 1500);
    } catch (_e) {
      location.hash = hash;
    }
  });

  saveBtn.addEventListener('click', async () => {
    const name = prompt('Name this scenario');
    if (!name) return;
    const headlineMedianMER = state.lastResult?.medianMER ?? Number.NaN;
    const stored: StoredScenario = {
      id: String(Date.now()),
      name,
      createdAt: Date.now(),
      config: state.cfg,
      headlineMedianMER,
    };
    await saveScenario(stored);
    saveBtn.textContent = 'Saved';
    setTimeout(() => (saveBtn.textContent = 'Save scenario'), 1500);
    void renderSavedList();
  });

  // Saved scenarios list
  const savedWrap = document.createElement('div');
  savedWrap.className = 'saved';
  savedWrap.innerHTML = '<h3>Saved scenarios</h3><div class="list"></div>';
  root.appendChild(savedWrap);

  async function renderSavedList(): Promise<void> {
    const list = savedWrap.querySelector('.list')!;
    list.innerHTML = '';
    const items = await listScenarios();
    items.sort((a, b) => b.createdAt - a.createdAt);
    if (items.length === 0) {
      list.innerHTML = '<p class="muted" style="font-size: 13px;">No scenarios saved yet. Run a simulation, then click <em>Save scenario</em>.</p>';
      return;
    }
    for (const s of items) {
      const row = document.createElement('div');
      row.className = 'saved-row';
      const nameEl = document.createElement('span');
      nameEl.className = 'name';
      nameEl.textContent = s.name;
      const metaEl = document.createElement('span');
      metaEl.className = 'meta-line';
      metaEl.textContent = `${new Date(s.createdAt).toLocaleDateString()} · MEDIAN ${fmtMER(s.headlineMedianMER)}`;
      const load = document.createElement('button');
      load.textContent = 'Load';
      load.addEventListener('click', () => {
        state.cfg = s.config;
        renderMonteCarloTab(root);
      });
      const del = document.createElement('button');
      del.textContent = 'Delete';
      del.addEventListener('click', async () => {
        await deleteScenario(s.id);
        void renderSavedList();
      });
      row.appendChild(nameEl);
      row.appendChild(metaEl);
      row.appendChild(load);
      row.appendChild(del);
      list.appendChild(row);
    }
  }

  void renderSavedList();
}

function getCssVar(name: string): string {
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim();
}

function requiredMERSafe(): number {
  let spendCents = 0;
  if (state.cfg.spend.kind === 'fixed') spendCents = state.cfg.spend.value;
  else if (state.cfg.spend.kind === 'triangular') spendCents = state.cfg.spend.mode;
  else if ('mean' in state.cfg.spend) spendCents = state.cfg.spend.mean;

  let cm = 0.5;
  if (state.cfg.contributionMargin.kind === 'fixed') cm = state.cfg.contributionMargin.value;
  else if (state.cfg.contributionMargin.kind === 'triangular') cm = state.cfg.contributionMargin.mode;
  else if ('mean' in state.cfg.contributionMargin) cm = state.cfg.contributionMargin.mean;

  let fixed = 0;
  if (state.cfg.fixedCosts.kind === 'fixed') fixed = state.cfg.fixedCosts.value;
  else if (state.cfg.fixedCosts.kind === 'triangular') fixed = state.cfg.fixedCosts.mode;
  else if ('mean' in state.cfg.fixedCosts) fixed = state.cfg.fixedCosts.mean;

  try {
    return requiredMER(spendCents, fixed, state.cfg.targetProfitCents, cm);
  } catch {
    return Number.NaN;
  }
}

function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

// ---------- Boot ----------
function boot(): void {
  const tabBar = document.querySelector<HTMLElement>('#tabs')!;
  const tabs = setupTabs(tabBar);

  const quickEl = document.querySelector<HTMLElement>('[data-panel="quick"]')!;
  const funnelEl = document.querySelector<HTMLElement>('[data-panel="funnel"]')!;
  const mcEl = document.querySelector<HTMLElement>('[data-panel="mc"]')!;

  renderQuickTab(quickEl);
  renderFunnelTab(funnelEl);
  renderMonteCarloTab(mcEl);

  tabs.setActive('quick');

  // Theme toggle
  const themeBtn = document.querySelector<HTMLButtonElement>('#theme-toggle');
  themeBtn?.addEventListener('click', () => {
    const cur = document.documentElement.dataset.theme ?? '';
    document.documentElement.dataset.theme = cur === 'dark' ? 'light' : 'dark';
  });

  void registerServiceWorker();
  void incrementVisitCount();
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', boot);
} else {
  boot();
}
