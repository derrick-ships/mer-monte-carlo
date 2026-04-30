// Tornado chart — horizontal correlation bars, sorted by |corr| descending.
// Color coded by sign so direction is readable at a glance.

import type { SensitivityRow } from '../math/sensitivity.js';

export type TornadoOpts = {
  canvas: HTMLCanvasElement;
  rows: SensitivityRow[];
  posColor?: string;
  negColor?: string;
};

export function drawTornado(opts: TornadoOpts): void {
  const { canvas, rows } = opts;
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  const dpr = Math.max(1, window.devicePixelRatio || 1);
  const cssW = canvas.clientWidth || 500;
  const cssH = canvas.clientHeight || Math.max(60, rows.length * 26 + 30);
  canvas.width = Math.round(cssW * dpr);
  canvas.height = Math.round(cssH * dpr);
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, cssW, cssH);

  if (rows.length === 0) return;

  const padL = 130;
  const padR = 60;
  const padT = 12;
  const padB = 18;
  const plotW = cssW - padL - padR;
  const rowH = (cssH - padT - padB) / rows.length;
  const cx = padL + plotW / 2;

  ctx.font = '12px system-ui, sans-serif';

  // Center axis
  ctx.strokeStyle = 'currentColor';
  ctx.globalAlpha = 0.4;
  ctx.beginPath();
  ctx.moveTo(cx, padT);
  ctx.lineTo(cx, padT + rowH * rows.length);
  ctx.stroke();
  ctx.globalAlpha = 1;

  for (let i = 0; i < rows.length; i++) {
    const r = rows[i]!;
    const yMid = padT + rowH * i + rowH / 2;
    const halfW = (r.abs * plotW) / 2;
    const isPos = r.corr >= 0;
    ctx.fillStyle = isPos ? opts.posColor ?? '#10b981' : opts.negColor ?? '#ef4444';
    if (isPos) ctx.fillRect(cx, yMid - rowH * 0.3, halfW, rowH * 0.6);
    else ctx.fillRect(cx - halfW, yMid - rowH * 0.3, halfW, rowH * 0.6);

    ctx.fillStyle = 'currentColor';
    ctx.textAlign = 'right';
    ctx.fillText(r.name, padL - 8, yMid + 4);

    ctx.textAlign = 'left';
    ctx.globalAlpha = 0.85;
    ctx.fillText(r.corr.toFixed(3), padL + plotW + 8, yMid + 4);
    ctx.globalAlpha = 1;
  }

  // Bottom scale
  ctx.fillStyle = 'currentColor';
  ctx.globalAlpha = 0.6;
  ctx.textAlign = 'center';
  ctx.fillText('-1', padL, padT + rowH * rows.length + 14);
  ctx.fillText('0', cx, padT + rowH * rows.length + 14);
  ctx.fillText('+1', padL + plotW, padT + rowH * rows.length + 14);
  ctx.globalAlpha = 1;
}
