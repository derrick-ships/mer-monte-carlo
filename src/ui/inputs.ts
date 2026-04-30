// Input form rendering and binding. The Monte Carlo tab swaps each scalar field
// for a distribution-spec block (kind selector + parameters); the Quick MER and
// Funnel tabs use plain numeric inputs and never sample.

import type { DistSpec } from '../math/simulator.js';

export type FieldKind = 'money' | 'rate' | 'mer' | 'count';

export type FieldDef = {
  id: string;
  label: string;
  hint?: string;
  kind: FieldKind;
  /** Which distributions this field allows in MC mode. */
  allowedDists: DistSpec['kind'][];
};

export const FUNNEL_FIELDS: FieldDef[] = [
  { id: 'spend', label: 'Marketing spend ($)', kind: 'money', allowedDists: ['fixed', 'triangular'] },
  { id: 'cpc', label: 'Cost per click ($)', kind: 'money', allowedDists: ['fixed', 'triangular', 'lognormal'] },
  { id: 'cvr', label: 'Conversion rate', hint: 'Decimal (e.g., 0.04 = 4%)', kind: 'rate', allowedDists: ['fixed', 'beta', 'triangular'] },
  { id: 'aov', label: 'Average order value ($)', kind: 'money', allowedDists: ['fixed', 'lognormal', 'triangular'] },
  { id: 'refundRate', label: 'Refund rate', hint: 'Decimal in [0,1)', kind: 'rate', allowedDists: ['fixed', 'beta', 'triangular'] },
  { id: 'contributionMargin', label: 'Contribution margin', hint: 'Decimal in (0,1]', kind: 'rate', allowedDists: ['fixed', 'beta', 'triangular'] },
  { id: 'fixedCosts', label: 'Fixed costs ($)', kind: 'money', allowedDists: ['fixed', 'triangular'] },
];

/** Render a labeled numeric input. */
export function renderNumericInput(
  parent: HTMLElement,
  id: string,
  label: string,
  value: number,
  onChange: (n: number) => void,
  hint?: string,
): HTMLInputElement {
  const wrap = document.createElement('label');
  wrap.className = 'field';
  wrap.htmlFor = id;
  const span = document.createElement('span');
  span.textContent = label;
  wrap.appendChild(span);
  const input = document.createElement('input');
  input.type = 'number';
  input.id = id;
  input.step = 'any';
  input.value = String(value);
  input.addEventListener('input', () => {
    const v = parseFloat(input.value);
    if (Number.isFinite(v)) onChange(v);
  });
  wrap.appendChild(input);
  if (hint) {
    const h = document.createElement('small');
    h.textContent = hint;
    h.className = 'hint';
    wrap.appendChild(h);
  }
  parent.appendChild(wrap);
  return input;
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
  const label = document.createElement('label');
  label.textContent = field.label;
  header.appendChild(label);
  const select = document.createElement('select');
  for (const d of field.allowedDists) {
    const opt = document.createElement('option');
    opt.value = d;
    opt.textContent = d;
    select.appendChild(opt);
  }
  select.value = initial.kind;
  header.appendChild(select);
  wrap.appendChild(header);

  const body = document.createElement('div');
  body.className = 'dist-body';
  wrap.appendChild(body);

  let current: DistSpec = initial;

  const numField = (lbl: string, v: number, set: (n: number) => void): void => {
    const w = document.createElement('label');
    w.className = 'sub-field';
    const s = document.createElement('span');
    s.textContent = lbl;
    w.appendChild(s);
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
    w.appendChild(inp);
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
        msg = `Range is only ${(rel * 100).toFixed(0)}% of the mode — that's tighter than typical real-world variance. Consider widening.`;
    } else if (current.kind === 'lognormal') {
      const cv = current.mean > 0 ? current.sd / current.mean : 0;
      if (cv > 0 && cv < 0.05)
        msg = `Coefficient of variation is ${(cv * 100).toFixed(0)}% — real CPC/AOV typically vary 20–40%.`;
    } else if (current.kind === 'beta') {
      const cv = current.mean > 0 ? current.sd / current.mean : 0;
      if (cv > 0 && cv < 0.05)
        msg = `Beta SD is unusually small relative to the mean. Real conversion-rate variance is typically larger.`;
    }
    tightnessEl.textContent = msg;
    tightnessEl.style.display = msg ? '' : 'none';
  }

  function renderBody(): void {
    body.replaceChildren();
    if (current.kind === 'fixed') {
      numField('value', current.value, (n) => {
        current = { kind: 'fixed', value: n };
      });
    } else if (current.kind === 'triangular') {
      numField('min', current.min, (n) => {
        current = { ...(current as Extract<DistSpec, { kind: 'triangular' }>), min: n };
      });
      numField('mode', current.mode, (n) => {
        current = { ...(current as Extract<DistSpec, { kind: 'triangular' }>), mode: n };
      });
      numField('max', current.max, (n) => {
        current = { ...(current as Extract<DistSpec, { kind: 'triangular' }>), max: n };
      });
    } else if (current.kind === 'lognormal') {
      numField('mean', current.mean, (n) => {
        current = { ...(current as Extract<DistSpec, { kind: 'lognormal' }>), mean: n };
      });
      numField('sd', current.sd, (n) => {
        current = { ...(current as Extract<DistSpec, { kind: 'lognormal' }>), sd: n };
      });
    } else if (current.kind === 'beta') {
      numField('mean', current.mean, (n) => {
        current = { ...(current as Extract<DistSpec, { kind: 'beta' }>), mean: n };
      });
      numField('sd', current.sd, (n) => {
        current = { ...(current as Extract<DistSpec, { kind: 'beta' }>), sd: n };
      });
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
