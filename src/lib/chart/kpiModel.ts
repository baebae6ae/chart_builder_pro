import type { ChartConfig, DataTable, MeasureAgg } from '@/types';
import { toNumber } from '@/lib/util/infer';
import { effectiveMeasures, measureName } from '@/lib/chart/plotData';

/**
 * KPI-card model. Collapses each measure to a single number over the whole
 * dataset (no grouping), producing the "infographic" output. A count measure
 * becomes the total record count — useful even for purely categorical data.
 */
export interface KpiCard {
  label: string;
  value: number;
  aggLabel: string;
}

export const AGG_LABEL: Record<MeasureAgg, string> = {
  count: '건수',
  sum: '합계',
  avg: '평균',
  min: '최소',
  max: '최대',
};

export const MEASURE_AGGS: MeasureAgg[] = ['count', 'sum', 'avg', 'min', 'max'];

function reduceAll(nums: number[], agg: MeasureAgg, rowCount: number): number {
  if (agg === 'count') return rowCount;
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

export function buildKpis(table: DataTable, chart: ChartConfig): KpiCard[] {
  return effectiveMeasures(chart).map((m) => {
    const ci = m.columnId === null ? -1 : table.columns.findIndex((c) => c.id === m.columnId);
    const nums =
      ci < 0 ? [] : table.rows.map((r) => toNumber(r[ci])).filter((n): n is number => n !== null);
    return {
      label: measureName(table, m),
      value: reduceAll(nums, m.agg, table.rows.length),
      aggLabel: AGG_LABEL[m.agg],
    };
  });
}
