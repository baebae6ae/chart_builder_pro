import type { ChartConfig, DataTable, Theme } from '@/types';
import { buildPlotData, type PlotData } from '@/lib/chart/plotData';

/**
 * Chart engine: (data + config + theme) -> ECharts option object.
 *
 * Pure and library-instance-free. All number-crunching (grouping, counting,
 * aggregation) happens in `buildPlotData`; this file only maps the resulting
 * categories/series onto an ECharts option per visualization type. The PPTX
 * exporter consumes the same PlotData, so the deck always matches the screen.
 */

const paletteOf = (theme: Theme) => (theme.colors.length > 0 ? theme.colors : ['#3b82f6']);

const base = (chart: ChartConfig, theme: Theme, palette: string[]) => ({
  color: palette,
  textStyle: { fontFamily: theme.fontFamily },
  title: chart.title
    ? { text: chart.title, left: 'center' as const, textStyle: { fontFamily: theme.fontFamily } }
    : undefined,
});

function cartesianOption(plot: PlotData, chart: ChartConfig, theme: Theme, stacked: boolean) {
  const palette = paletteOf(theme);
  const usesRight = plot.series.some((s) => s.axis === 'yRight');

  const makeY = (position: 'left' | 'right') => ({
    type: 'value' as const,
    position,
    splitLine: { lineStyle: { type: 'dashed' as const } },
  });
  const yAxis = usesRight ? [makeY('left'), makeY('right')] : [makeY('left')];

  const series = plot.series.map((s, i) => {
    const echType = stacked || s.type === 'bar' ? 'bar' : 'line';
    return {
      name: s.name,
      type: echType,
      yAxisIndex: s.axis === 'yRight' && usesRight ? 1 : 0,
      data: s.values,
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
      data: plot.categories,
      boundaryGap: stacked || plot.series.some((s) => s.type === 'bar'),
      axisLabel: { interval: 0, hideOverlap: true },
    },
    yAxis,
    series,
  };
}

function pieOption(plot: PlotData, chart: ChartConfig, theme: Theme) {
  const palette = paletteOf(theme);
  const first = plot.series[0];
  const data = plot.categories.map((name, i) => ({ name, value: first?.values[i] ?? 0 }));
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

function scatterOption(plot: PlotData, chart: ChartConfig, theme: Theme) {
  const palette = paletteOf(theme);
  const [xS, ...ys] = plot.series;
  const xVals = xS?.values ?? [];

  const series = ys.map((yS, i) => ({
    name: `${xS?.name ?? 'X'} × ${yS.name}`,
    type: 'scatter' as const,
    symbolSize: 12,
    data: yS.values.map((y, r) => [xVals[r] ?? null, y]),
    itemStyle: { color: palette[i % palette.length] },
  }));

  return {
    ...base(chart, theme, palette),
    tooltip: { trigger: 'item' as const },
    legend: { bottom: 0, type: 'scroll' as const },
    grid: { left: 56, right: 24, top: chart.title ? 48 : 24, bottom: 48 },
    xAxis: { type: 'value' as const, name: xS?.name ?? '', scale: true },
    yAxis: { type: 'value' as const, scale: true },
    series,
  };
}

function radarOption(plot: PlotData, chart: ChartConfig, theme: Theme) {
  const palette = paletteOf(theme);
  const indicator = plot.categories.map((name, i) => {
    const max = Math.max(0, ...plot.series.map((s) => s.values[i] ?? 0));
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
        data: plot.series.map((s, i) => ({
          name: s.name,
          value: s.values.map((v) => v ?? 0),
          itemStyle: { color: palette[i % palette.length] },
          areaStyle: { opacity: 0.1 },
        })),
      },
    ],
  };
}

/** Build the ECharts option for the chart-rendered visualization types. */
export function buildOption(table: DataTable, chart: ChartConfig, theme: Theme) {
  const plot = buildPlotData(table, chart);
  switch (chart.viz) {
    case 'pie':
    case 'donut':
      return pieOption(plot, chart, theme);
    case 'scatter':
      return scatterOption(plot, chart, theme);
    case 'radar':
      return radarOption(plot, chart, theme);
    case 'stackedBar':
      return cartesianOption(plot, chart, theme, true);
    case 'combo':
    default:
      return cartesianOption(plot, chart, theme, false);
  }
}
