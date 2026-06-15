import type {
  CellValue,
  ChartConfig,
  DataTable,
  Insight,
  InsightKind,
  MeasureAgg,
  SeriesConfig,
  SeriesType,
  VizType,
} from '@/types';
import { uid } from '@/lib/util/id';
import { isBlank, toNumber } from '@/lib/util/infer';
import { formatCompact, formatNumber } from '@/lib/util/format';
import { profileColumns, type ColumnProfile } from '@/lib/analyze/profile';
import {
  coverage,
  concentration,
  cardinalityFit,
  pearson,
} from '@/lib/analyze/insightScore';
import {
  detectColumnGroups,
  meltColumns,
  pivotCount,
  topNWithOther,
} from '@/lib/analyze/transform';

/**
 * Insight-generation engine. Profiles the table once, runs a set of independent
 * rules, and returns a diversified, ranked list of self-contained {@link Insight}
 * objects (each carrying its own derived `table` + `chart`). Works on *any* file:
 * a purely categorical table still yields distribution / rollup / kpi / ranking.
 */

interface Ctx {
  table: DataTable;
  profiles: ColumnProfile[];
  rowCount: number;
  dims: ColumnProfile[];
  texts: ColumnProfile[];
  dates: ColumnProfile[];
  measures: ColumnProfile[];
}

function colIdx(table: DataTable, columnId: string): number {
  return table.columns.findIndex((c) => c.id === columnId);
}

function columnCells(table: DataTable, columnId: string): CellValue[] {
  const ci = colIdx(table, columnId);
  return ci < 0 ? [] : table.rows.map((r) => r[ci]);
}

function makeChart(partial: Partial<ChartConfig> & { title: string }): ChartConfig {
  return {
    viz: 'combo',
    xColumnId: null,
    series: [],
    aggregate: false,
    ...partial,
  };
}

function series(
  columnId: string | null,
  type: SeriesType,
  agg: MeasureAgg,
): SeriesConfig {
  return { columnId, axis: 'yLeft', type, agg };
}

function makeInsight(
  kind: InsightKind,
  title: string,
  caption: string,
  score: number,
  table: DataTable,
  chart: ChartConfig,
): Insight {
  return { id: uid('ins'), kind, title, caption, score, table, chart };
}

/** Group source rows by a dimension and sum a measure, fold tail into '기타'. */
function groupSum(
  table: DataTable,
  dimId: string,
  measureId: string | null,
  keep: number,
): { table: DataTable; topLabel: string; topValue: number; topShare: number } {
  const di = colIdx(table, dimId);
  const mi = measureId === null ? -1 : colIdx(table, measureId);
  const map = new Map<string, number>();
  for (const row of table.rows) {
    const dv = row[di];
    if (isBlank(dv)) continue;
    const key = String(dv).trim();
    const inc = mi < 0 ? 1 : toNumber(row[mi]) ?? 0;
    map.set(key, (map.get(key) ?? 0) + inc);
  }
  const sorted = [...map.entries()].sort((a, b) => b[1] - a[1]);
  const head = sorted.slice(0, keep);
  const tail = sorted.slice(keep);
  const tailSum = tail.reduce((acc, [, v]) => acc + v, 0);
  const rows: CellValue[][] = head.map(([k, v]) => [k, v]);
  if (tailSum > 0) rows.push(['기타', tailSum]);
  const total = sorted.reduce((acc, [, v]) => acc + v, 0);
  const topLabel = sorted[0]?.[0] ?? '';
  const topValue = sorted[0]?.[1] ?? 0;
  const topShare = total > 0 ? topValue / total : 0;
  const valueName = measureId === null ? '건수' : '값';
  return {
    table: {
      columns: [
        { id: 'cat', name: '항목', type: 'string' },
        { id: 'val', name: valueName, type: 'number' },
      ],
      rows,
    },
    topLabel,
    topValue,
    topShare,
  };
}

const pct = (x: number): string => `${formatNumber(x * 100)}%`;

// ---------------------------------------------------------------------------
// R1 — distribution: top-N category counts per dimension (text fallback).
// ---------------------------------------------------------------------------
function ruleDistribution(ctx: Ctx): Insight[] {
  const out: Insight[] = [];
  const candidates = [...ctx.dims, ...ctx.texts.filter((t) => t.distinct <= 30)];

  for (const col of candidates) {
    const derived = topNWithOther(columnCells(ctx.table, col.columnId), 8);
    if (derived.rows.length === 0) continue;

    const counts = derived.rows.map((r) => Number(r[1]) || 0);
    const total = counts.reduce((a, b) => a + b, 0);
    if (total === 0) continue;
    const conc = concentration(counts);
    const distinct = derived.rows.length;

    // Combined share of the top up-to-3 rows for the caption.
    const topK = Math.min(3, distinct);
    const topShare = counts.slice(0, topK).reduce((a, b) => a + b, 0) / total;

    const viz: VizType = distinct <= 6 ? (distinct <= 4 ? 'pie' : 'donut') : 'combo';
    const chart = makeChart({
      title: `${col.name} 분포`,
      viz,
      xColumnId: 'cat',
      series: [series('count', 'bar', 'sum')],
      aggregate: false,
    });

    const caption = `상위 ${topK}개 ${col.name}이(가) 전체의 ${pct(topShare)}`;
    const score = 60 + 30 * conc + 5 * cardinalityFit(col.distinct) * coverage(col, ctx.rowCount);
    out.push(makeInsight('distribution', `${col.name} 분포`, caption, score, derived, chart));
  }
  return out;
}

// ---------------------------------------------------------------------------
// R2 — crossRollup: melt shared-vocabulary column groups, then top-N.
// ---------------------------------------------------------------------------
function ruleCrossRollup(ctx: Ctx): Insight[] {
  const out: Insight[] = [];
  const groups = detectColumnGroups(ctx.table, ctx.profiles);

  for (const g of groups) {
    const melted = meltColumns(ctx.table, g.columnIds, g.label);
    const derived = topNWithOther(melted.rows.map((r) => r[0]), 8);
    if (derived.rows.length === 0) continue;

    const counts = derived.rows.map((r) => Number(r[1]) || 0);
    const total = counts.reduce((a, b) => a + b, 0);
    if (total === 0) continue;
    const conc = concentration(counts);
    const distinct = derived.rows.length;

    const topLabel = String(derived.rows[0][0]);
    const topShare = (Number(derived.rows[0][1]) || 0) / total;

    const viz: VizType = distinct <= 5 ? 'donut' : 'combo';
    const chart = makeChart({
      title: `${g.label} 통합 분포`,
      viz,
      xColumnId: 'cat',
      series: [series('count', 'bar', 'sum')],
      aggregate: false,
    });

    const caption = `${g.label} ${g.columnIds.length}개 항목 통합 시 '${topLabel}'이(가) ${pct(
      topShare,
    )}로 가장 많음`;
    const score = 70 + 30 * conc;
    out.push(makeInsight('crossRollup', `${g.label} 통합 분포`, caption, score, derived, chart));
  }
  return out;
}

// ---------------------------------------------------------------------------
// R3 — breakdown: best dims × best measures (sum). Pre-aggregate wide dims.
// ---------------------------------------------------------------------------
function ruleBreakdown(ctx: Ctx): Insight[] {
  const out: Insight[] = [];
  if (ctx.measures.length === 0) return out;
  const dims = ctx.dims.slice(0, 2);
  const measures = ctx.measures.slice(0, 2);

  for (const dim of dims) {
    for (const m of measures) {
      const wide = dim.distinct > 10;
      const g = groupSum(ctx.table, dim.columnId, m.columnId, 8);
      if (!g.topLabel) continue;

      // Concentration of the grouped totals (how much the top categories lead).
      const conc = concentration(g.table.rows.map((r) => Number(r[1]) || 0));

      let table: DataTable;
      let chart: ChartConfig;
      if (wide) {
        // Pre-aggregated derived [cat, val] table renders the folded tail intact.
        table = g.table;
        chart = makeChart({
          title: `${dim.name}별 ${m.name}`,
          viz: 'combo',
          xColumnId: 'cat',
          series: [series('val', 'bar', 'sum')],
          aggregate: false,
        });
      } else {
        // Small dim: bind to source columns and let buildPlotData group+sum.
        table = ctx.table;
        chart = makeChart({
          title: `${dim.name}별 ${m.name}`,
          viz: 'combo',
          xColumnId: dim.columnId,
          series: [series(m.columnId, 'bar', 'sum')],
          aggregate: true,
        });
      }

      const caption = `'${g.topLabel}'의 ${m.name} 합계가 ${formatCompact(g.topValue)} (${pct(
        g.topShare,
      )})로 최대`;
      const score = 55 + 25 * conc + coverage(m, ctx.rowCount);
      out.push(makeInsight('breakdown', `${dim.name}별 ${m.name}`, caption, score, table, chart));
    }
  }
  return out;
}

// ---------------------------------------------------------------------------
// R4 — trend: a measure (or count) over time.
// ---------------------------------------------------------------------------
function ruleTrend(ctx: Ctx): Insight[] {
  const out: Insight[] = [];
  if (ctx.dates.length === 0) return out;
  const date = ctx.dates[0];
  const measure = ctx.measures[0] ?? null;

  // Aggregate the series ourselves to drive the caption (first vs last).
  const di = colIdx(ctx.table, date.columnId);
  const mi = measure ? colIdx(ctx.table, measure.columnId) : -1;
  const map = new Map<string, number>();
  const order: string[] = [];
  for (const row of ctx.table.rows) {
    const dv = row[di];
    if (isBlank(dv)) continue;
    const key = String(dv).trim();
    if (!map.has(key)) order.push(key);
    const inc = mi < 0 ? 1 : toNumber(row[mi]) ?? 0;
    map.set(key, (map.get(key) ?? 0) + inc);
  }
  order.sort();
  if (order.length < 2) return out;

  const first = map.get(order[0]) ?? 0;
  const last = map.get(order[order.length - 1]) ?? 0;
  const delta = first !== 0 ? (last - first) / Math.abs(first) : last > 0 ? 1 : 0;
  const slopeNorm = Math.max(-1, Math.min(1, delta));
  const measureName = measure ? measure.name : '건수';

  const chart = makeChart({
    title: `${date.name}별 ${measureName} 추세`,
    viz: 'combo',
    xColumnId: date.columnId,
    series: measure ? [series(measure.columnId, 'line', 'sum')] : [],
    aggregate: true,
  });

  const dir = last >= first ? '증가' : '감소';
  const caption = `${measureName}이(가) ${formatCompact(first)} 대비 ${formatCompact(
    last,
  )} ${pct(Math.abs(delta))} ${dir}`;
  const score = 60 + 20 * Math.abs(slopeNorm) + coverage(date, ctx.rowCount);
  out.push(
    makeInsight('trend', `${date.name}별 ${measureName} 추세`, caption, score, ctx.table, chart),
  );
  return out;
}

// ---------------------------------------------------------------------------
// R5 — correlation: strongest measure pair as a scatter.
// ---------------------------------------------------------------------------
function ruleCorrelation(ctx: Ctx): Insight[] {
  if (ctx.measures.length < 2) return [];

  let best: { a: ColumnProfile; b: ColumnProfile; r: number; n: number } | null = null;
  for (let i = 0; i < ctx.measures.length; i += 1) {
    for (let j = i + 1; j < ctx.measures.length; j += 1) {
      const a = ctx.measures[i];
      const b = ctx.measures[j];
      const ai = colIdx(ctx.table, a.columnId);
      const bi = colIdx(ctx.table, b.columnId);
      const xs: number[] = [];
      const ys: number[] = [];
      for (const row of ctx.table.rows) {
        const x = toNumber(row[ai]);
        const y = toNumber(row[bi]);
        if (x !== null && y !== null) {
          xs.push(x);
          ys.push(y);
        }
      }
      if (xs.length < 6) continue;
      const r = pearson(xs, ys);
      if (!best || Math.abs(r) > Math.abs(best.r)) best = { a, b, r, n: xs.length };
    }
  }

  if (!best || Math.abs(best.r) < 0.3) return [];

  const strength = Math.abs(best.r) >= 0.7 ? '강한' : Math.abs(best.r) >= 0.5 ? '중간' : '약한';
  const sign = best.r >= 0 ? '양' : '음';
  const chart = makeChart({
    title: `${best.a.name} × ${best.b.name} 상관`,
    viz: 'scatter',
    xColumnId: null,
    series: [series(best.a.columnId, 'line', 'sum'), series(best.b.columnId, 'line', 'sum')],
    aggregate: false,
  });
  const caption = `${best.a.name}와 ${best.b.name}는 ${strength} ${sign}의 상관 (r=${formatNumber(
    best.r,
  )})`;
  const score = 50 + 45 * Math.abs(best.r);
  return [
    makeInsight(
      'correlation',
      `${best.a.name} × ${best.b.name} 상관`,
      caption,
      score,
      ctx.table,
      chart,
    ),
  ];
}

// ---------------------------------------------------------------------------
// R6 — composition: dim A × dim B as a 100%-stacked bar.
// ---------------------------------------------------------------------------
function ruleComposition(ctx: Ctx): Insight[] {
  if (ctx.dims.length < 2) return [];

  // dim A: a broader category to put on the axis; dim B: a small sub-breakdown.
  const dimA = ctx.dims[0];
  const subCandidate = ctx.dims.find(
    (d) => d.columnId !== dimA.columnId && d.distinct >= 2 && d.distinct <= 6,
  );
  if (!subCandidate) return [];

  const derived = pivotCount(ctx.table, dimA.columnId, subCandidate.columnId, 8);
  if (derived.rows.length === 0 || derived.columns.length < 2) return [];

  const subColumns = derived.columns.slice(1);
  const seriesCfgs = subColumns.map((c) => series(c.id, 'bar', 'sum'));

  // Find top A row and its dominant subcategory for the caption.
  const topRow = derived.rows[0];
  const topA = String(topRow[0]);
  let topSubName = '';
  let topSubShare = 0;
  subColumns.forEach((c, i) => {
    const share = Number(topRow[i + 1]) || 0;
    if (share > topSubShare) {
      topSubShare = share;
      topSubName = c.name;
    }
  });

  const chart = makeChart({
    title: `${dimA.name}별 ${subCandidate.name} 구성`,
    viz: 'stackedBar',
    xColumnId: 'cat',
    series: seriesCfgs,
    aggregate: false,
  });
  const caption = `'${dimA.name}'별 '${subCandidate.name}' 구성: '${topA}'에서 '${topSubName}' 비중 ${formatNumber(
    topSubShare,
  )}%`;
  const score = 50 + 20 * concentration(subColumns.map((_, i) => Number(topRow[i + 1]) || 0));
  return [
    makeInsight(
      'composition',
      `${dimA.name}별 ${subCandidate.name} 구성`,
      caption,
      score,
      derived,
      chart,
    ),
  ];
}

// ---------------------------------------------------------------------------
// R7 — kpi: measure totals, or a single record-count card. Always emitted.
// ---------------------------------------------------------------------------
function ruleKpi(ctx: Ctx): Insight[] {
  if (ctx.measures.length > 0) {
    const picked = ctx.measures.slice(0, 4);
    const chart = makeChart({
      title: '핵심 지표',
      viz: 'kpi',
      xColumnId: null,
      series: picked.map((m) => series(m.columnId, 'bar', 'sum')),
      aggregate: false,
    });
    const caption = `총 ${formatNumber(ctx.rowCount)}건 · 주요 지표 ${picked.length}개 요약`;
    return [makeInsight('kpi', '핵심 지표', caption, 58, ctx.table, chart)];
  }

  const chart = makeChart({
    title: '총 건수',
    viz: 'kpi',
    xColumnId: ctx.dims[0]?.columnId ?? null,
    series: [],
    aggregate: true,
  });
  const caption = `총 ${formatNumber(ctx.rowCount)}건`;
  return [makeInsight('kpi', '총 건수', caption, 58, ctx.table, chart)];
}

// ---------------------------------------------------------------------------
// R8 — ranking: best dim × (measure or count) as a top-10 table.
// ---------------------------------------------------------------------------
function ruleRanking(ctx: Ctx): Insight[] {
  const dim = ctx.dims[0] ?? ctx.texts.find((t) => t.distinct <= 30);
  if (!dim) return [];
  const measure = ctx.measures[0] ?? null;

  const g = groupSum(ctx.table, dim.columnId, measure ? measure.columnId : null, 10);
  if (g.table.rows.length === 0) return [];

  const basis = measure ? measure.name : '건수';
  const k = Math.min(10, g.table.rows.length);
  const chart = makeChart({
    title: `${dim.name} 순위`,
    viz: 'table',
    xColumnId: 'cat',
    series: [series('val', 'bar', 'sum')],
    aggregate: false,
  });
  const caption = `상위 ${k}개 ${dim.name} 순위 (${basis} 기준)`;
  return [makeInsight('ranking', `${dim.name} 순위`, caption, 52, g.table, chart)];
}

// ---------------------------------------------------------------------------
// Orchestration: run rules, rank, diversity-cap to 8..12.
// ---------------------------------------------------------------------------
export function generateInsights(table: DataTable): Insight[] {
  const profiles = profileColumns(table);
  const ctx: Ctx = {
    table,
    profiles,
    rowCount: table.rows.length,
    dims: profiles
      .filter((p) => p.role === 'dimension')
      .sort((a, b) => a.distinct - b.distinct),
    texts: profiles.filter((p) => p.role === 'text').sort((a, b) => a.distinct - b.distinct),
    dates: profiles.filter((p) => p.role === 'date'),
    measures: profiles.filter((p) => p.role === 'measure'),
  };

  const all: Insight[] = [
    ...ruleDistribution(ctx),
    ...ruleCrossRollup(ctx),
    ...ruleBreakdown(ctx),
    ...ruleTrend(ctx),
    ...ruleCorrelation(ctx),
    ...ruleComposition(ctx),
    ...ruleKpi(ctx),
    ...ruleRanking(ctx),
  ].sort((a, b) => b.score - a.score);

  // Diversity cap: limit certain kinds, always keep a kpi and a ranking/table.
  const capByKind: Partial<Record<InsightKind, number>> = {
    distribution: 3,
    breakdown: 2,
    trend: 2,
    crossRollup: 2,
    composition: 1,
  };
  const taken: Record<string, number> = {};
  const picked: Insight[] = [];

  // Reserve one kpi and one ranking up front so the cap never crowds them out.
  const reserved: Insight[] = [];
  const kpi = all.find((i) => i.kind === 'kpi');
  const ranking = all.find((i) => i.kind === 'ranking' || i.kind === 'distribution');
  if (kpi) reserved.push(kpi);
  if (ranking && ranking !== kpi) reserved.push(ranking);
  for (const r of reserved) {
    picked.push(r);
    taken[r.kind] = (taken[r.kind] ?? 0) + 1;
  }

  for (const ins of all) {
    if (picked.length >= 12) break;
    if (picked.includes(ins)) continue;
    const cap = capByKind[ins.kind];
    if (cap !== undefined && (taken[ins.kind] ?? 0) >= cap) continue;
    picked.push(ins);
    taken[ins.kind] = (taken[ins.kind] ?? 0) + 1;
  }

  // Re-sort the final selection by score so the strongest leads.
  return picked.sort((a, b) => b.score - a.score).slice(0, 12);
}
