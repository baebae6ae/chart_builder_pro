/** Number formatting shared by KPI cards, tables and chart labels. */

/**
 * Locale-aware number formatting with a sensible, value-dependent precision:
 * integers stay whole, large numbers drop decimals, small fractions keep a few.
 */
export function formatNumber(n: number): string {
  if (!Number.isFinite(n)) return '-';
  const abs = Math.abs(n);
  const digits = abs > 0 && abs < 1 ? 4 : Number.isInteger(n) ? 0 : 1;
  return n.toLocaleString('ko-KR', { maximumFractionDigits: digits });
}

/** Compact form for big KPI numbers (e.g. 12,345,000 -> 1,234.5만). */
export function formatCompact(n: number): string {
  if (!Number.isFinite(n)) return '-';
  const abs = Math.abs(n);
  if (abs >= 1e8) return `${formatNumber(n / 1e8)}억`;
  if (abs >= 1e4) return `${formatNumber(n / 1e4)}만`;
  return formatNumber(n);
}
