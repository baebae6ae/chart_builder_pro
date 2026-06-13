import type { Aggregation, ChartConfig, DataTable } from '@/types';
import { columnName, seriesData } from '@/lib/chart/buildOption';

/**
 * KPI-card model. Collapses each measure column to a single number under the
 * chosen aggregation, producing the "infographic" output. Pure logic; the view
 * only formats and lays out the cards.
 */
export interface KpiCard {
  label: string;
  value: number;
  aggLabel: string;
}

export const AGG_LABEL: Record<Aggregation, string> = {
  sum: '합계',
  avg: '평균',
  min: '최소',
  max: '최대',
  count: '개수',
  last: '마지막',
};

export const AGGREGATIONS: Aggregation[] = ['sum', 'avg', 'min', 'max', 'count', 'last'];

/** Reduce a column of numbers (nulls ignored) to one value. */
export function aggregate(values: (number | null)[], agg: Aggregation): number {
  const nums = values.filter((v): v is number => v !== null);
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
    case 'count':
      return nums.length;
    case 'last':
      return nums[nums.length - 1];
  }
}

export function buildKpis(table: DataTable, chart: ChartConfig): KpiCard[] {
  return chart.series.map((s) => ({
    label: columnName(table, s.columnId),
    value: aggregate(seriesData(table, s), chart.agg),
    aggLabel: AGG_LABEL[chart.agg],
  }));
}
