// Input form rendering. Each field carries its plain-English definition,
// the format the user should type, and a concrete example. The Monte Carlo
// tab swaps each scalar field for a distribution-spec block; Quick MER and
// Funnel tabs use plain numeric inputs.

import type { DistSpec } from '../math/simulator.js';
import { GLOSSARY, type GlossaryEntry } from './glossary.js';

export type FieldKind = 'money' | 'rate' | 'mer' | 'count';

export type FieldDef = {
  id: string;
  label: string;
  /** Glossary key — defaults to `id` if not specified. */
  glossaryKey?: string;
  hint?: string;
  kind: FieldKind;
  /** Which distributions this field allows in MC mode. */
  allowedDists: DistSpec['kind'][];
};

export const FUNNEL_FIELDS: FieldDef[] = [
  { id: 'spend', label: 'Ad spend', kind: 'money', allowedDists: ['fixed', 'triangular'] },
  { id: 'cpc', label: 'Cost per click', kind: 'money', allowedDists: ['fixed', 'triangular', 'lognormal'] },
  { id: 'cvr', label: 'Conversion rate', kind: 'rate', allowedDists: ['fixed', 'beta', 'triangular'] },
  { id: 'aov', label: 'Average order value', kind: 'money', allowedDists: ['fixed', 'lognormal', 'triangular'] },
  { id: 'refundRate', label: 'Refund rate', kind: 'rate', allowedDists: ['fixed', 'beta', 'triangular'] },
  { id: 'contributionMargin', label: 'Contribution margin', kind: 'rate', allowedDists: ['fixed', 'beta', 'triangular'] },
  { id: 'fixedCosts', label: 'Fixed costs', kind: 'money', allowedDists: ['fixed', 'triangular'] },
];

export type AffixSpec = { prefix?: string; suffix?: string };

/** Format affixes by field kind — what shows inside the input box. */
export function affixesFor(kind: FieldKind | 'seed' | 'iterations'): AffixSpec {
  switch (kind) {
    case 'money':
      return { prefix: '$', suffix: 'USD' };
    case 'rate':
      return { suffix: '0.00–1.00' };
    case 'mer':
      return { suffix: 'x' };
    case 'count':
      return { suffix: '#' };
    case 'seed':
      return { suffix: 'SEED' };
    case 'iterations':
      return { suffix: 'RUNS' };
    default:
      return {};
  }
}

/** Render a labeled numeric input with prefix/suffix, definition, and example. */
export function renderNumericInput(
  parent: HTMLElement,
  id: string,
  label: string,
  value: number,
  onChange: (n: number) => void,
  opts: {
    glossaryKey?: string;
    affix?: AffixSpec;
    hint?: string;
    step?: string;
  } = {},
): HTMLInputElement {
  const wrap = document.createElement('label');
  wrap.className = 'field';
  wrap.htmlFor = id;

  const labelEl = document.createElement('span');
  labelEl.className = 'field-label';
  labelEl.textContent = label;
  wrap.appendChild(labelEl);

  // Definition
  const entry = opts.glossaryKey ? GLOSSARY[opts.glossaryKey] : undefined;
  if (entry) appendDefinition(wrap, entry);

  // Input shell with prefix/suffix
  const shell = document.createElement('div');
  shell.className = 'input-shell';
  if (opts.affix?.prefix) {
    const pre = document.createElement('span');
    pre.className = 'affix prefix';
    pre.textContent = opts.affix.prefix;
    shell.appendChild(pre);
  }
  const input = document.createElement('input');
  input.type = 'number';
  input.id = id;
  input.step = opts.step ?? 'any';
  input.value = String(value);
  input.addEventListener('input', () => {
    const v = parseFloat(input.value);
    if (Number.isFinite(v)) onChange(v);
  });
  shell.appendChild(input);
  if (opts.affix?.suffix) {
    const suf = document.createElement('span');
    suf.className = 'affix suffix';
    suf.textContent = opts.affix.suffix;
    shell.appendChild(suf);
  }
  // If no affix at all, keep grid layout sensible
  if (!opts.affix?.prefix && !opts.affix?.suffix) {
    shell.style.gridTemplateColumns = '1fr';
  } else if (!opts.affix?.prefix) {
    shell.style.gridTemplateColumns = '1fr auto';
  } else if (!opts.affix?.suffix) {
    shell.style.gridTemplateColumns = 'auto 1fr';
  }
  wrap.appendChild(shell);

  if (opts.hint) {
    const h = document.createElement('small');
    h.className = 'field-meta';
    h.textContent = opts.hint;
    wrap.appendChild(h);
  }

  parent.appendChild(wrap);
  return input;
}

function appendDefinition(parent: HTMLElement, entry: GlossaryEntry): void {
  const def = document.createElement('p');
  def.className = 'field-def';
  def.textContent = entry.short;
  parent.appendChild(def);

  if (entry.format || entry.example) {
    const meta = document.createElement('small');
    meta.className = 'field-meta';
    const parts: string[] = [];
    if (entry.format) parts.push(`Format: ${entry.format}`);
    if (entry.example) parts.push(`e.g., ${entry.example}`);
    meta.textContent = parts.join('  ·  ');
    parent.appendChild(meta);
  }
}

/** Render a distribution-spec editor for a single field. */
export function renderDistField(
  parent: HTMLElement,
  field: FieldDef,
  initial: DistSpec,
  onChange: (spec: DistSpec) => void,
): void {
  const wrap = document.createElement('div');
  wrap.className = 'dist-field';

  const header = document.createElement('div');
  header.className = 'dist-header';
  const label = document.createElement('span');
  label.className = 'field-label';
  label.textContent = field.label;
  header.appendChild(label);

  const select = document.createElement('select');
  select.className = 'bare';
  for (const d of field.allowedDists) {
    const opt = document.createElement('option');
    opt.value = d;
    opt.textContent = distLabel(d);
    select.appendChild(opt);
  }
  select.value = initial.kind;
  header.appendChild(select);
  wrap.appendChild(header);

  const entry = GLOSSARY[field.glossaryKey ?? field.id];
  if (entry) {
    const def = document.createElement('p');
    def.className = 'field-def';
    def.textContent = entry.short;
    wrap.appendChild(def);
    if (entry.format || entry.example) {
      const meta = document.createElement('small');
      meta.className = 'field-meta';
      const parts: string[] = [];
      if (entry.format) parts.push(`Format: ${entry.format}`);
      if (entry.example) parts.push(`e.g., ${entry.example}`);
      meta.textContent = parts.join('  ·  ');
      wrap.appendChild(meta);
    }
  }

  // Distribution-kind explanation strip (changes when kind changes)
  const kindDef = document.createElement('p');
  kindDef.className = 'dist-kind-def';
  wrap.appendChild(kindDef);

  const body = document.createElement('div');
  body.className = 'dist-body';
  wrap.appendChild(body);

  let current: DistSpec = initial;

  const numField = (
    lbl: string,
    v: number,
    set: (n: number) => void,
    affix?: AffixSpec,
  ): void => {
    const w = document.createElement('label');
    w.className = 'sub-field';
    const s = document.createElement('span');
    s.textContent = lbl;
    w.appendChild(s);
    const shell = document.createElement('div');
    shell.className = 'input-shell';
    if (affix?.prefix) {
      const pre = document.createElement('span');
      pre.className = 'affix prefix';
      pre.textContent = affix.prefix;
      shell.appendChild(pre);
    }
    const inp = document.createElement('input');
    inp.type = 'number';
    inp.step = 'any';
    inp.value = String(v);
    inp.addEventListener('input', () => {
      const n = parseFloat(inp.value);
      if (Number.isFinite(n)) {
        set(n);
        onChange(current);
        renderTightnessHint();
      }
    });
    shell.appendChild(inp);
    if (affix?.suffix) {
      const suf = document.createElement('span');
      suf.className = 'affix suffix';
      suf.textContent = affix.suffix;
      shell.appendChild(suf);
    }
    if (!affix?.prefix && !affix?.suffix) shell.style.gridTemplateColumns = '1fr';
    else if (!affix?.prefix) shell.style.gridTemplateColumns = '1fr auto';
    else if (!affix?.suffix) shell.style.gridTemplateColumns = 'auto 1fr';
    w.appendChild(shell);
    body.appendChild(w);
  };

  // Tightness hint: warn on suspiciously narrow ranges.
  const tightnessEl = document.createElement('small');
  tightnessEl.className = 'hint warn';

  function renderTightnessHint(): void {
    let msg = '';
    if (current.kind === 'triangular') {
      const span = current.max - current.min;
      const rel = current.mode > 0 ? span / current.mode : 0;
      if (rel < 0.1)
        msg = `This range is only ${(rel * 100).toFixed(0)}% of the most-likely value — tighter than typical real-world variance. Consider widening.`;
    } else if (current.kind === 'lognormal') {
      const cv = current.mean > 0 ? current.sd / current.mean : 0;
      if (cv > 0 && cv < 0.05)
        msg = `Variation is only ${(cv * 100).toFixed(0)}% of the mean — real CPC and AOV typically vary 20–40%. Consider widening.`;
    } else if (current.kind === 'beta') {
      const cv = current.mean > 0 ? current.sd / current.mean : 0;
      if (cv > 0 && cv < 0.05)
        msg = `Variation is unusually small relative to the mean. Real conversion-rate variance is typically larger.`;
    }
    tightnessEl.textContent = msg;
    tightnessEl.style.display = msg ? '' : 'none';
  }

  function affixForField(): AffixSpec {
    return field.kind === 'money'
      ? { prefix: '$' }
      : field.kind === 'rate'
        ? { suffix: '0–1' }
        : {};
  }

  function renderBody(): void {
    body.replaceChildren();
    const affix = affixForField();
    if (current.kind === 'fixed') {
      kindDef.textContent = GLOSSARY.fixed.short;
      numField('value', current.value, (n) => {
        current = { kind: 'fixed', value: n };
      }, affix);
    } else if (current.kind === 'triangular') {
      kindDef.textContent = GLOSSARY.triangular.short;
      numField('low', current.min, (n) => {
        current = { ...(current as Extract<DistSpec, { kind: 'triangular' }>), min: n };
      }, affix);
      numField('most likely', current.mode, (n) => {
        current = { ...(current as Extract<DistSpec, { kind: 'triangular' }>), mode: n };
      }, affix);
      numField('high', current.max, (n) => {
        current = { ...(current as Extract<DistSpec, { kind: 'triangular' }>), max: n };
      }, affix);
    } else if (current.kind === 'lognormal') {
      kindDef.textContent = GLOSSARY.lognormal.short;
      numField('mean', current.mean, (n) => {
        current = { ...(current as Extract<DistSpec, { kind: 'lognormal' }>), mean: n };
      }, affix);
      numField('std dev', current.sd, (n) => {
        current = { ...(current as Extract<DistSpec, { kind: 'lognormal' }>), sd: n };
      }, affix);
    } else if (current.kind === 'beta') {
      kindDef.textContent = GLOSSARY.beta.short;
      numField('mean', current.mean, (n) => {
        current = { ...(current as Extract<DistSpec, { kind: 'beta' }>), mean: n };
      }, affix);
      numField('std dev', current.sd, (n) => {
        current = { ...(current as Extract<DistSpec, { kind: 'beta' }>), sd: n };
      }, affix);
    }
    body.appendChild(tightnessEl);
    renderTightnessHint();
  }

  select.addEventListener('change', () => {
    const k = select.value as DistSpec['kind'];
    // Re-init with sensible defaults when switching kinds.
    if (k === 'fixed') current = { kind: 'fixed', value: 1 };
    else if (k === 'triangular') current = { kind: 'triangular', min: 0.5, mode: 1, max: 1.5 };
    else if (k === 'lognormal') current = { kind: 'lognormal', mean: 1, sd: 0.2 };
    else current = { kind: 'beta', mean: 0.5, sd: 0.1 };
    renderBody();
    onChange(current);
  });

  renderBody();
  parent.appendChild(wrap);
}

function distLabel(k: DistSpec['kind']): string {
  switch (k) {
    case 'fixed':
      return 'Fixed value';
    case 'triangular':
      return 'Range (low / likely / high)';
    case 'lognormal':
      return 'Lognormal (price-shaped)';
    case 'beta':
      return 'Beta (rate-shaped)';
  }
}
