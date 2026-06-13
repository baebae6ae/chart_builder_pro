import type { DataTable, ChartConfig, Theme, SeriesConfig } from '@/types';
import { toNumber } from '@/lib/util/infer';

/**
 * Chart engine: (data + config + theme) -> ECharts option object.
 *
 * This is a pure function with no React or ECharts-instance dependency, so the
 * same option can be rendered live, rendered in a snapshot, or inspected in a
 * test. The PPTX exporter reads the *same* DataTable/ChartConfig, guaranteeing
 * the downloaded deck matches the on-screen chart.
 */

const colIndex = (table: DataTable, columnId: string | null): number =>
  columnId === null ? -1 : table.columns.findIndex((c) => c.id === columnId);

const columnValues = (table: DataTable, index: number) =>
  index < 0 ? [] : table.rows.map((row) => row[index] ?? null);

/** Category labels for the X axis (falls back to row numbers). */
export function categories(table: DataTable, chart: ChartConfig): string[] {
  const xi = colIndex(table, chart.xColumnId);
  if (xi < 0) return table.rows.map((_, i) => String(i + 1));
  return columnValues(table, xi).map((v) => (v === null ? '' : String(v)));
}

/** Numeric data points for one series, in row order. */
export function seriesData(table: DataTable, series: SeriesConfig): (number | null)[] {
  const ci = colIndex(table, series.columnId);
  return columnValues(table, ci).map(toNumber);
}

const columnName = (table: DataTable, columnId: string): string =>
  table.columns.find((c) => c.id === columnId)?.name ?? columnId;

/** Build the full ECharts option. */
export function buildOption(table: DataTable, chart: ChartConfig, theme: Theme) {
  const usesRight = chart.series.some((s) => s.axis === 'yRight');
  const palette = theme.colors.length > 0 ? theme.colors : ['#3b82f6'];

  const makeY = (position: 'left' | 'right') => ({
    type: 'value' as const,
    position,
    splitLine: { lineStyle: { type: 'dashed' as const } },
  });
  const yAxis = usesRight ? [makeY('left'), makeY('right')] : [makeY('left')];

  const series = chart.series.map((s, i) => ({
    name: columnName(table, s.columnId),
    type: s.type,
    yAxisIndex: s.axis === 'yRight' && usesRight ? 1 : 0,
    data: seriesData(table, s),
    smooth: s.type === 'line',
    itemStyle: { color: palette[i % palette.length] },
    barMaxWidth: 48,
  }));

  return {
    color: palette,
    textStyle: { fontFamily: theme.fontFamily },
    title: chart.title
      ? { text: chart.title, left: 'center', textStyle: { fontFamily: theme.fontFamily } }
      : undefined,
    tooltip: { trigger: 'axis' as const, axisPointer: { type: 'shadow' as const } },
    legend: { bottom: 0, type: 'scroll' as const },
    grid: { left: 48, right: usesRight ? 48 : 24, top: chart.title ? 48 : 24, bottom: 48 },
    xAxis: {
      type: 'category' as const,
      data: categories(table, chart),
      boundaryGap: chart.series.some((s) => s.type === 'bar'),
    },
    yAxis,
    series,
  };
}
