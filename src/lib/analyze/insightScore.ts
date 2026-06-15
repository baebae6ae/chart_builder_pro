import type { ColumnProfile } from '@/lib/analyze/profile';

/**
 * Small, documented scoring primitives used to rank insights. Each returns a
 * number normalized to roughly 0..1 so rule scores compose predictably.
 */

/** How well a column is populated: non-blank rows / total rows (0..1). */
export function coverage(profile: ColumnProfile, rowCount: number): number {
  if (rowCount <= 0) return 0;
  return Math.min(1, profile.nonNull / rowCount);
}

/**
 * How concentrated a set of counts is (0..1). Returns the combined share of the
 * top-k buckets (k = ceil(20% of buckets), min 1) — high when a few categories
 * dominate, which makes a distribution worth surfacing.
 */
export function concentration(counts: number[]): number {
  if (counts.length === 0) return 0;
  const total = counts.reduce((a, b) => a + b, 0);
  if (total <= 0) return 0;
  const sorted = [...counts].sort((a, b) => b - a);
  const k = Math.max(1, Math.ceil(sorted.length * 0.2));
  const topSum = sorted.slice(0, k).reduce((a, b) => a + b, 0);
  return Math.min(1, topSum / total);
}

/**
 * Preference for category counts that chart well — peaks around 3..12 distinct
 * values, falling off for too-few (binary) or too-many (cluttered) categories.
 */
export function cardinalityFit(distinct: number): number {
  if (distinct <= 1) return 0;
  const ideal = 7; // centre of the 3..12 sweet spot
  const spread = 6;
  const fit = 1 - Math.abs(distinct - ideal) / spread;
  return Math.max(0, Math.min(1, fit));
}

/**
 * Pearson correlation coefficient of two equal-length numeric arrays (-1..1).
 * Returns 0 when there is no variance or fewer than two paired points.
 */
export function pearson(xs: number[], ys: number[]): number {
  const n = Math.min(xs.length, ys.length);
  if (n < 2) return 0;
  let sx = 0;
  let sy = 0;
  for (let i = 0; i < n; i += 1) {
    sx += xs[i];
    sy += ys[i];
  }
  const mx = sx / n;
  const my = sy / n;
  let cov = 0;
  let vx = 0;
  let vy = 0;
  for (let i = 0; i < n; i += 1) {
    const dx = xs[i] - mx;
    const dy = ys[i] - my;
    cov += dx * dy;
    vx += dx * dx;
    vy += dy * dy;
  }
  if (vx === 0 || vy === 0) return 0;
  return cov / Math.sqrt(vx * vy);
}
