// Canvas-based histogram. ~150 lines, no chart library. We choose bin width
// via Freedman-Diaconis but switch to log-spaced bins when skewness is large
// (typical for net-revenue distributions on viral campaigns).

import { freedmanDiaconisBinWidth, quantileSorted } from '../math/statistics.js';

export type HistogramOpts = {
  canvas: HTMLCanvasElement;
  data: ArrayLike<number>;
  /** Optional vertical reference line (e.g., target MER). */
  threshold?: number;
  thresholdLabel?: string;
  axisLabel?: string;
  color?: string;
  thresholdColor?: string;
};

function skewness(sortedAscending: ArrayLike<number>): number {
  const n = sortedAscending.length;
  if (n < 3) return 0;
  let mean = 0;
  for (let i = 0; i < n; i++) mean += sortedAscending[i];
  mean /= n;
  let m2 = 0;
  let m3 = 0;
  for (let i = 0; i < n; i++) {
    const d = sortedAscending[i] - mean;
    m2 += d * d;
    m3 += d * d * d;
  }
  m2 /= n;
  m3 /= n;
  const sd = Math.sqrt(m2);
  return sd > 0 ? m3 / (sd * sd * sd) : 0;
}

export function drawHistogram(opts: HistogramOpts): void {
  const { canvas, data } = opts;
  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  // High-DPI canvas. Caller sets CSS size; we adjust the backing store.
  const dpr = Math.max(1, window.devicePixelRatio || 1);
  const cssW = canvas.clientWidth || 600;
  const cssH = canvas.clientHeight || 240;
  canvas.width = Math.round(cssW * dpr);
  canvas.height = Math.round(cssH * dpr);
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, cssW, cssH);

  if (data.length === 0) return;

  // Sort copy (caller may pass pre-sorted, but we don't trust).
  const sorted = new Float64Array(data.length);
  for (let i = 0; i < data.length; i++) sorted[i] = data[i];
  sorted.sort();

  const min = sorted[0]!;
  const max = sorted[sorted.length - 1]!;
  if (max <= min) return;

  // Switch to log-spaced bins for highly-skewed strictly-positive data.
  const useLog = min > 0 && skewness(sorted) > 2;

  const fdWidth = freedmanDiaconisBinWidth(sorted);
  const desiredBins = useLog ? 30 : Math.max(8, Math.min(60, Math.ceil((max - min) / fdWidth)));
  const edges = new Float64Array(desiredBins + 1);
  if (useLog) {
    const lmin = Math.log(min);
    const lmax = Math.log(max);
    for (let i = 0; i <= desiredBins; i++) edges[i] = Math.exp(lmin + ((lmax - lmin) * i) / desiredBins);
  } else {
    for (let i = 0; i <= desiredBins; i++) edges[i] = min + ((max - min) * i) / desiredBins;
  }

  const counts = new Int32Array(desiredBins);
  let j = 0;
  for (let i = 0; i < sorted.length; i++) {
    while (j < desiredBins - 1 && sorted[i]! >= edges[j + 1]!) j++;
    counts[j]++;
  }
  let maxCount = 0;
  for (let i = 0; i < desiredBins; i++) if (counts[i]! > maxCount) maxCount = counts[i]!;
  if (maxCount === 0) return;

  // Layout
  const padL = 44;
  const padR = 12;
  const padT = 12;
  const padB = 28;
  const plotW = cssW - padL - padR;
  const plotH = cssH - padT - padB;

  // Bars
  ctx.fillStyle = opts.color ?? '#3b82f6';
  for (let i = 0; i < desiredBins; i++) {
    const x0 = padL + ((edges[i]! - min) / (max - min)) * plotW;
    const x1 = padL + ((edges[i + 1]! - min) / (max - min)) * plotW;
    const h = (counts[i]! / maxCount) * plotH;
    ctx.fillRect(x0, padT + (plotH - h), Math.max(1, x1 - x0 - 1), h);
  }

  // Axes
  ctx.strokeStyle = 'currentColor';
  ctx.globalAlpha = 0.4;
  ctx.beginPath();
  ctx.moveTo(padL, padT + plotH + 0.5);
  ctx.lineTo(padL + plotW, padT + plotH + 0.5);
  ctx.stroke();
  ctx.globalAlpha = 1;

  // X-axis ticks: P10 / P50 / P90
  const ticks = [
    { q: 0.1, label: 'P10' },
    { q: 0.5, label: 'P50' },
    { q: 0.9, label: 'P90' },
  ];
  ctx.fillStyle = 'currentColor';
  ctx.font = '11px system-ui, sans-serif';
  ctx.textAlign = 'center';
  for (const t of ticks) {
    const v = quantileSorted(sorted, t.q);
    const x = padL + ((v - min) / (max - min)) * plotW;
    ctx.globalAlpha = 0.5;
    ctx.beginPath();
    ctx.moveTo(x, padT);
    ctx.lineTo(x, padT + plotH);
    ctx.stroke();
    ctx.globalAlpha = 1;
    ctx.fillText(t.label, x, padT + plotH + 14);
  }

  // Threshold line
  if (opts.threshold !== undefined && opts.threshold >= min && opts.threshold <= max) {
    const tx = padL + ((opts.threshold - min) / (max - min)) * plotW;
    ctx.strokeStyle = opts.thresholdColor ?? '#ef4444';
    ctx.lineWidth = 2;
    ctx.setLineDash([4, 4]);
    ctx.beginPath();
    ctx.moveTo(tx, padT);
    ctx.lineTo(tx, padT + plotH);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.lineWidth = 1;
    if (opts.thresholdLabel) {
      ctx.fillStyle = opts.thresholdColor ?? '#ef4444';
      ctx.textAlign = 'left';
      ctx.fillText(opts.thresholdLabel, tx + 4, padT + 12);
    }
  }

  // Axis label
  if (opts.axisLabel) {
    ctx.fillStyle = 'currentColor';
    ctx.globalAlpha = 0.7;
    ctx.textAlign = 'right';
    ctx.fillText(opts.axisLabel, cssW - padR, cssH - 6);
    ctx.globalAlpha = 1;
  }
}
