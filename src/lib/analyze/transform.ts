import type { CellValue, DataTable } from '@/types';
import { isBlank, toNumber } from '@/lib/util/infer';
import type { ColumnProfile } from '@/lib/analyze/profile';

/**
 * Pure table transforms for the insight engine. Everything here turns a source
 * {@link DataTable} into a small *derived* table whose ids are fixed ('cat',
 * 'val', 'count', 'c0'...) so each produced Insight is self-contained and renders
 * in raw (non-aggregated) mode without referencing the source columns.
 */

/** A cluster of sibling string columns that share a name stem and vocabulary. */
export interface ColumnGroup {
  /** Common stem, e.g. "리스크" for 리스크1/리스크2. */
  label: string;
  columnIds: string[];
  /** Average pairwise Jaccard of the members' distinct value sets (0..1). */
  sharedVocab: number;
}

/** Strip trailing index-like suffixes so 리스크1 / 리스크_2 / RiskII collapse. */
function nameStem(name: string): string {
  return name
    .trim()
    .replace(/[\s_\-+]*(?:[0-9]+|[ivxlcdm]+)$/i, '')
    .replace(/[\s_\-+]+$/, '')
    .trim();
}

function distinctValues(table: DataTable, colIdx: number): Set<string> {
  const out = new Set<string>();
  for (const row of table.rows) {
    const v = row[colIdx];
    if (!isBlank(v)) out.add(String(v).trim());
  }
  return out;
}

function jaccard(a: Set<string>, b: Set<string>): number {
  if (a.size === 0 && b.size === 0) return 0;
  let inter = 0;
  for (const v of a) if (b.has(v)) inter += 1;
  const union = a.size + b.size - inter;
  return union === 0 ? 0 : inter / union;
}

function setsEqual(a: Set<string>, b: Set<string>): boolean {
  if (a.size !== b.size) return false;
  for (const v of a) if (!b.has(v)) return false;
  return true;
}

/**
 * Cluster sibling category columns by name stem, then keep only clusters whose
 * members genuinely share a vocabulary (average pairwise Jaccard >= 0.4). Exact
 * duplicate columns within a cluster are dropped so they don't inflate counts.
 */
export function detectColumnGroups(
  table: DataTable,
  profiles: ColumnProfile[],
): ColumnGroup[] {
  const idxById = new Map(table.columns.map((c, i) => [c.id, i] as const));

  // Eligible: low-cardinality string-ish columns (dimension, or text<=30 distinct).
  const eligible = profiles.filter(
    (p) =>
      (p.role === 'dimension' || p.role === 'text') && p.distinct >= 1 && p.distinct <= 30,
  );

  const byStem = new Map<string, ColumnProfile[]>();
  for (const p of eligible) {
    const stem = nameStem(p.name) || p.name.trim();
    const bucket = byStem.get(stem);
    if (bucket) bucket.push(p);
    else byStem.set(stem, [p]);
  }

  const groups: ColumnGroup[] = [];
  for (const [stem, members] of byStem) {
    if (members.length < 2) continue;

    // Drop exact-duplicate columns (identical distinct value sets) — keep first.
    const kept: { id: string; set: Set<string> }[] = [];
    for (const m of members) {
      const ci = idxById.get(m.columnId);
      if (ci === undefined) continue;
      const set = distinctValues(table, ci);
      if (kept.some((k) => setsEqual(k.set, set))) continue;
      kept.push({ id: m.columnId, set });
    }
    if (kept.length < 2) continue;

    // Average pairwise Jaccard.
    let sum = 0;
    let pairs = 0;
    for (let i = 0; i < kept.length; i += 1) {
      for (let j = i + 1; j < kept.length; j += 1) {
        sum += jaccard(kept[i].set, kept[j].set);
        pairs += 1;
      }
    }
    const sharedVocab = pairs === 0 ? 0 : sum / pairs;
    if (sharedVocab < 0.4) continue;

    groups.push({ label: stem, columnIds: kept.map((k) => k.id), sharedVocab });
  }

  return groups.sort((a, b) => b.sharedVocab - a.sharedVocab);
}

/**
 * Melt several columns into a single long column. Each non-blank cell across the
 * given columns becomes one row. Result has exactly one column {id:'val'}.
 */
export function meltColumns(
  table: DataTable,
  columnIds: string[],
  label: string,
): DataTable {
  const idxById = new Map(table.columns.map((c, i) => [c.id, i] as const));
  const idxs = columnIds.map((id) => idxById.get(id)).filter((i): i is number => i !== undefined);

  const rows: CellValue[][] = [];
  for (const row of table.rows) {
    for (const ci of idxs) {
      const v = row[ci];
      if (!isBlank(v)) rows.push([typeof v === 'number' ? v : String(v).trim()]);
    }
  }

  return { columns: [{ id: 'val', name: label, type: 'string' }], rows };
}

/**
 * Count occurrences of a long list of cell values, keep the top `n`, and fold
 * the remaining tail into a single `otherLabel` row. Output is a pre-aggregated
 * 2-column table [cat, count] that renders one bar/slice per row in raw mode.
 */
export function topNWithOther(
  values: CellValue[],
  n: number,
  otherLabel = '기타',
): DataTable {
  const counts = new Map<string, number>();
  for (const v of values) {
    if (isBlank(v)) continue;
    const key = String(v).trim();
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }

  const sorted = [...counts.entries()].sort((a, b) => b[1] - a[1]);
  const head = sorted.slice(0, n);
  const tail = sorted.slice(n);
  const tailSum = tail.reduce((acc, [, c]) => acc + c, 0);

  const rows: CellValue[][] = head.map(([label, count]) => [label, count]);
  if (tailSum > 0) rows.push([otherLabel, tailSum]);

  return {
    columns: [
      { id: 'cat', name: '항목', type: 'string' },
      { id: 'count', name: '건수', type: 'number' },
    ],
    rows,
  };
}

function topValues(table: DataTable, colIdx: number, n: number): string[] {
  const counts = new Map<string, number>();
  for (const row of table.rows) {
    const v = row[colIdx];
    if (isBlank(v)) continue;
    const key = String(v).trim();
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, n)
    .map(([k]) => k);
}

/**
 * Cross-tabulate two dimensions: rows are the top-N values of dim A, columns are
 * the top (<=6) values of dim B plus a folded '기타' column, and each cell is a
 * count (or sum of a measure). Every row is then normalized to sum 100, ready for
 * a 100%-stacked composition chart. Column ids: 'cat', then 'c0','c1',...
 */
export function pivotCount(
  table: DataTable,
  dimAId: string,
  dimBId: string,
  topN: number,
  measureId?: string,
): DataTable {
  const idxById = new Map(table.columns.map((c, i) => [c.id, i] as const));
  const aIdx = idxById.get(dimAId);
  const bIdx = idxById.get(dimBId);
  if (aIdx === undefined || bIdx === undefined) {
    return { columns: [{ id: 'cat', name: '항목', type: 'string' }], rows: [] };
  }
  const mIdx = measureId !== undefined ? idxById.get(measureId) : undefined;

  const topA = topValues(table, aIdx, topN);
  const aSet = new Set(topA);
  const topB = topValues(table, bIdx, 6);
  const bSet = new Set(topB);
  const otherLabel = '기타';

  // Sub-column labels in fixed order: top B values, then '기타' if a tail exists.
  const subLabels = [...topB];

  // Accumulate matrix[aLabel][subLabel] = count or measure-sum.
  const matrix = new Map<string, Map<string, number>>();
  for (const a of topA) matrix.set(a, new Map<string, number>());
  let needOther = false;

  for (const row of table.rows) {
    const av = row[aIdx];
    const bv = row[bIdx];
    if (isBlank(av) || isBlank(bv)) continue;
    const aKey = String(av).trim();
    if (!aSet.has(aKey)) continue;
    const bRaw = String(bv).trim();
    const bKey = bSet.has(bRaw) ? bRaw : otherLabel;
    if (bKey === otherLabel) needOther = true;

    const inc = mIdx !== undefined ? toNumber(row[mIdx]) ?? 0 : 1;
    const bucket = matrix.get(aKey)!;
    bucket.set(bKey, (bucket.get(bKey) ?? 0) + inc);
  }

  if (needOther) subLabels.push(otherLabel);

  const columns = [
    { id: 'cat', name: '항목', type: 'string' as const },
    ...subLabels.map((name, i) => ({ id: `c${i}`, name, type: 'number' as const })),
  ];

  const rows: CellValue[][] = topA.map((a) => {
    const bucket = matrix.get(a)!;
    const raw = subLabels.map((sub) => bucket.get(sub) ?? 0);
    const total = raw.reduce((acc, v) => acc + v, 0);
    const normalized = raw.map((v) => (total > 0 ? (v / total) * 100 : 0));
    return [a, ...normalized];
  });

  return { columns, rows };
}
