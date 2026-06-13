import type { CellValue, ChartConfig, DataTable, MeasureAgg, SeriesConfig } from '@/types';
import { isBlank, toNumber } from '@/lib/util/infer';

/**
 * Plot-data engine — the single place raw rows become plottable numbers.
 *
 * Every renderer (charts, table, KPI cards, PPTX export) consumes the output of
 * {@link buildPlotData}, so aggregation logic lives in exactly one spot. This is
 * what lets categorical data (no numeric columns) still produce charts: a
 * dimension can be grouped and counted.
 */
export interface PlotSeries {
  name: string;
  axis: 'yLeft' | 'yRight';
  type: SeriesConfig['type'];
  values: (number | null)[];
}

export interface PlotData {
  categories: string[];
  series: PlotSeries[];
}

const colIndex = (table: DataTable, columnId: string | null): number =>
  columnId === null ? -1 : table.columns.findIndex((c) => c.id === columnId);

const AGG_SUFFIX: Record<MeasureAgg, string> = {
  count: '',
  sum: '',
  avg: ' (평균)',
  min: ' (최소)',
  max: ' (최대)',
};

export function measureName(table: DataTable, m: SeriesConfig): string {
  if (m.columnId === null || m.agg === 'count') return '건수';
  const name = table.columns.find((c) => c.id === m.columnId)?.name ?? m.columnId;
  return `${name}${AGG_SUFFIX[m.agg]}`;
}

function reduce(nums: number[], agg: MeasureAgg, groupSize: number): number {
  if (agg === 'count') return groupSize;
  if (nums.length === 0) return 0;
  switch (agg) {
    case 'sum':
      return nums.reduce((a, b) => a + b, 0);
    case 'avg':
      return nums.reduce((a, b) => a + b, 0) / nums.length;
    case 'min':
      return Math.min(...nums);
    case 'max':
      return Math.max(...nums);
  }
}

/**
 * The effective measures of a chart. When grouping is on and the user has set a
 * dimension but no measures, a single COUNT measure is synthesized so a chart
 * appears from one categorical column alone.
 */
export function effectiveMeasures(chart: ChartConfig): SeriesConfig[] {
  if (chart.aggregate && chart.xColumnId && chart.series.length === 0) {
    return [{ columnId: null, axis: 'yLeft', type: 'bar', agg: 'count' }];
  }
  return chart.series;
}

/** Number of measures that will actually be plotted (incl. synthesized count). */
export const measureCount = (chart: ChartConfig): number => effectiveMeasures(chart).length;

function columnNumbers(table: DataTable, rowIdxs: number[], colIdx: number): number[] {
  if (colIdx < 0) return [];
  const out: number[] = [];
  for (const r of rowIdxs) {
    const n = toNumber(table.rows[r][colIdx]);
    if (n !== null) out.push(n);
  }
  return out;
}

export function buildPlotData(table: DataTable, chart: ChartConfig): PlotData {
  const dimIdx = colIndex(table, chart.xColumnId);
  const measures = effectiveMeasures(chart);

  // ---- Grouped (aggregated) mode -----------------------------------------
  if (chart.aggregate && dimIdx >= 0) {
    const order: string[] = [];
    const groups = new Map<string, number[]>();
    table.rows.forEach((row, r) => {
      const dv = row[dimIdx];
      if (isBlank(dv)) return; // drop placeholder rows (null, '-', etc.)
      const key = String(dv);
      const bucket = groups.get(key);
      if (bucket) bucket.push(r);
      else {
        groups.set(key, [r]);
        order.push(key);
      }
    });

    const series: PlotSeries[] = measures.map((m) => {
      const ci = colIndex(table, m.columnId);
      const values = order.map((key) => {
        const idxs = groups.get(key)!;
        return reduce(columnNumbers(table, idxs, ci), m.agg, idxs.length);
      });
      return { name: measureName(table, m), axis: m.axis, type: m.type, values };
    });

    // Sort categorical distributions by the first measure (largest first) so the
    // most significant bars/slices lead. Dates/numbers keep their natural order.
    let categories = order;
    const dimType = table.columns[dimIdx]?.type;
    if (dimType === 'string' && series.length > 0) {
      const rank = order
        .map((_, i) => i)
        .sort((a, b) => (series[0].values[b] ?? 0) - (series[0].values[a] ?? 0));
      categories = rank.map((i) => order[i]);
      series.forEach((s) => {
        s.values = rank.map((i) => s.values[i]);
      });
    }

    return { categories, series };
  }

  // ---- Raw mode (one point per row) --------------------------------------
  const categories =
    dimIdx >= 0
      ? table.rows.map((r) => {
          const v: CellValue = r[dimIdx];
          return v === null ? '' : String(v);
        })
      : table.rows.map((_, i) => String(i + 1));

  const series: PlotSeries[] = measures
    .filter((m) => m.columnId !== null)
    .map((m) => {
      const ci = colIndex(table, m.columnId);
      return {
        name: measureName(table, m),
        axis: m.axis,
        type: m.type,
        values: table.rows.map((r) => toNumber(r[ci])),
      };
    });

  return { categories, series };
}
