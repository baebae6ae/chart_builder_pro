import type { DataTable, ChartConfig, Theme, SeriesConfig } from '@/types';
import { toNumber } from '@/lib/util/infer';

/**
 * Chart engine: (data + config + theme) -> ECharts option object.
 *
 * Pure and library-instance-free, so the same option renders live, renders in a
 * snapshot, or can be inspected in a test. The builder dispatches on the chosen
 * visualization type; the shared `categories`/`seriesData` helpers are reused by
 * the PPTX exporter so the downloaded deck always matches the screen.
 *
 * Non-ECharts visualizations (table, KPI) are handled by their own pure models
 * (tableModel.ts / kpiModel.ts); this file only covers ECharts-rendered types.
 */

const colIndex = (table: DataTable, columnId: string | null): number =>
  columnId === null ? -1 : table.columns.findIndex((c) => c.id === columnId);

const columnValues = (table: DataTable, index: number) =>
  index < 0 ? [] : table.rows.map((row) => row[index] ?? null);

/** Category labels for the dimension axis (falls back to row numbers). */
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

export const columnName = (table: DataTable, columnId: string): string =>
  table.columns.find((c) => c.id === columnId)?.name ?? columnId;

const paletteOf = (theme: Theme) =>
  theme.colors.length > 0 ? theme.colors : ['#3b82f6'];

/** Shared header (palette/font/title) spread into every option. */
const base = (chart: ChartConfig, theme: Theme, palette: string[]) => ({
  color: palette,
  textStyle: { fontFamily: theme.fontFamily },
  title: chart.title
    ? { text: chart.title, left: 'center' as const, textStyle: { fontFamily: theme.fontFamily } }
    : undefined,
});

/** Cartesian bar/line/area combo, optionally stacked. */
function cartesianOption(table: DataTable, chart: ChartConfig, theme: Theme, stacked: boolean) {
  const palette = paletteOf(theme);
  const usesRight = chart.series.some((s) => s.axis === 'yRight');

  const makeY = (position: 'left' | 'right') => ({
    type: 'value' as const,
    position,
    splitLine: { lineStyle: { type: 'dashed' as const } },
  });
  const yAxis = usesRight ? [makeY('left'), makeY('right')] : [makeY('left')];

  const series = chart.series.map((s, i) => {
    const echType = stacked || s.type === 'bar' ? 'bar' : 'line';
    return {
      name: columnName(table, s.columnId),
      type: echType,
      yAxisIndex: s.axis === 'yRight' && usesRight ? 1 : 0,
      data: seriesData(table, s),
      smooth: echType === 'line',
      areaStyle: !stacked && s.type === 'area' ? {} : undefined,
      stack: stacked ? 'total' : undefined,
      itemStyle: { color: palette[i % palette.length] },
      barMaxWidth: 48,
    };
  });

  return {
    ...base(chart, theme, palette),
    tooltip: { trigger: 'axis' as const, axisPointer: { type: 'shadow' as const } },
    legend: { bottom: 0, type: 'scroll' as const },
    grid: { left: 56, right: usesRight ? 56 : 24, top: chart.title ? 48 : 24, bottom: 48 },
    xAxis: {
      type: 'category' as const,
      data: categories(table, chart),
      boundaryGap: stacked || chart.series.some((s) => s.type === 'bar'),
    },
    yAxis,
    series,
  };
}

/** Pie / donut: dimension labels weighted by the first measure. */
function pieOption(table: DataTable, chart: ChartConfig, theme: Theme) {
  const palette = paletteOf(theme);
  const labels = categories(table, chart);
  const measure = chart.series[0];
  const values = measure ? seriesData(table, measure) : [];
  const data = labels.map((name, i) => ({ name, value: values[i] ?? 0 }));
  const donut = chart.viz === 'donut';

  return {
    ...base(chart, theme, palette),
    tooltip: { trigger: 'item' as const, formatter: '{b}: {c} ({d}%)' },
    legend: { bottom: 0, type: 'scroll' as const },
    series: [
      {
        type: 'pie' as const,
        radius: donut ? ['42%', '70%'] : '68%',
        center: ['50%', chart.title ? '54%' : '48%'],
        data,
        label: { formatter: '{b}\n{d}%' },
      },
    ],
  };
}

/** Scatter: X = first measure, Y = the remaining measures. */
function scatterOption(table: DataTable, chart: ChartConfig, theme: Theme) {
  const palette = paletteOf(theme);
  const [xS, ...ys] = chart.series;
  const xVals = xS ? seriesData(table, xS) : [];

  const series = ys.map((yS, i) => ({
    name: `${columnName(table, xS.columnId)} × ${columnName(table, yS.columnId)}`,
    type: 'scatter' as const,
    symbolSize: 12,
    data: seriesData(table, yS).map((y, r) => [xVals[r] ?? null, y]),
    itemStyle: { color: palette[i % palette.length] },
  }));

  return {
    ...base(chart, theme, palette),
    tooltip: { trigger: 'item' as const },
    legend: { bottom: 0, type: 'scroll' as const },
    grid: { left: 56, right: 24, top: chart.title ? 48 : 24, bottom: 48 },
    xAxis: { type: 'value' as const, name: xS ? columnName(table, xS.columnId) : '', scale: true },
    yAxis: { type: 'value' as const, scale: true },
    series,
  };
}

/** Radar: dimension rows become indicators, each measure a polygon. */
function radarOption(table: DataTable, chart: ChartConfig, theme: Theme) {
  const palette = paletteOf(theme);
  const labels = categories(table, chart);
  const seriesVals = chart.series.map((s) => seriesData(table, s));

  const indicator = labels.map((name, i) => {
    const max = Math.max(0, ...seriesVals.map((v) => v[i] ?? 0));
    return { name, max: max > 0 ? max * 1.15 : 1 };
  });

  return {
    ...base(chart, theme, palette),
    tooltip: { trigger: 'item' as const },
    legend: { bottom: 0, type: 'scroll' as const },
    radar: { indicator, radius: '62%', center: ['50%', chart.title ? '54%' : '50%'] },
    series: [
      {
        type: 'radar' as const,
        data: chart.series.map((s, i) => ({
          name: columnName(table, s.columnId),
          value: seriesData(table, s).map((v) => v ?? 0),
          itemStyle: { color: palette[i % palette.length] },
          areaStyle: { opacity: 0.1 },
        })),
      },
    ],
  };
}

/** Build the ECharts option for the chart-rendered visualization types. */
export function buildOption(table: DataTable, chart: ChartConfig, theme: Theme) {
  switch (chart.viz) {
    case 'pie':
    case 'donut':
      return pieOption(table, chart, theme);
    case 'scatter':
      return scatterOption(table, chart, theme);
    case 'radar':
      return radarOption(table, chart, theme);
    case 'stackedBar':
      return cartesianOption(table, chart, theme, true);
    case 'combo':
    default:
      return cartesianOption(table, chart, theme, false);
  }
}
