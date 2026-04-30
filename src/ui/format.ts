// Display formatters. Single source of truth for currency / percent / number
// formatting so we don't end up with three different ways of printing $0.

const USD = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
  maximumFractionDigits: 0,
});

const USD_CENTS = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
  maximumFractionDigits: 2,
});

const PCT = new Intl.NumberFormat('en-US', {
  style: 'percent',
  maximumFractionDigits: 1,
});

const NUM2 = new Intl.NumberFormat('en-US', { maximumFractionDigits: 2 });

export function fmtMoneyCents(cents: number): string {
  if (!Number.isFinite(cents)) return '—';
  return USD.format(cents / 100);
}

export function fmtMoneyCentsPrecise(cents: number): string {
  if (!Number.isFinite(cents)) return '—';
  return USD_CENTS.format(cents / 100);
}

export function fmtPercent(p: number): string {
  if (!Number.isFinite(p)) return '—';
  return PCT.format(p);
}

export function fmtNum(x: number): string {
  if (!Number.isFinite(x)) return '—';
  return NUM2.format(x);
}

export function fmtMER(x: number): string {
  if (!Number.isFinite(x)) return '—';
  return NUM2.format(x) + 'x';
}

export function dollarsToCents(d: number): number {
  return Math.round(d * 100);
}
