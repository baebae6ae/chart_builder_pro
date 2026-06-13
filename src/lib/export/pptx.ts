import type PptxGenJS from 'pptxgenjs';
import type { DataTable, ChartConfig, Theme } from '@/types';
import { categories, seriesData } from '@/lib/chart/buildOption';

/**
 * Native PPTX export.
 *
 * pptxgenjs writes a *real* PowerPoint chart part (c:chart XML), not a picture.
 * The downloaded deck therefore opens with a live, editable chart whose data
 * sheet can be tweaked in PowerPoint afterwards — fulfilling the "수정 가능한
 * 아웃풋" requirement. Generation runs in the browser; nothing is uploaded.
 *
 * The exporter consumes the same DataTable/ChartConfig the on-screen chart uses
 * (via the shared `categories`/`seriesData` helpers), so what you see is what
 * you ship.
 */

const columnName = (table: DataTable, columnId: string): string =>
  table.columns.find((c) => c.id === columnId)?.name ?? columnId;

const hex = (c: string) => c.replace('#', '').toUpperCase();

/**
 * Build a chart object on a single slide and trigger a browser download.
 * Mixed bar+line with an optional secondary axis maps directly onto
 * pptxgenjs's multi-type chart support.
 */
export async function exportToPptx(
  table: DataTable,
  chart: ChartConfig,
  theme: Theme,
  fileName = 'chart-builder-pro.pptx',
): Promise<void> {
  // Loaded on demand: the ~385 kB pptxgenjs bundle only arrives when a user
  // actually clicks export, keeping it out of the initial page load.
  const { default: PptxGenJSCtor } = await import('pptxgenjs');
  const pptx = new PptxGenJSCtor();
  pptx.defineLayout({ name: 'WIDE', width: 13.33, height: 7.5 });
  pptx.layout = 'WIDE';

  const slide = pptx.addSlide();
  const labels = categories(table, chart);
  const palette = theme.colors.length > 0 ? theme.colors : ['#2563eb'];

  const usesRight = chart.series.some((s) => s.axis === 'yRight');

  // pptxgenjs renders a combo chart from an array of {type, data, options}.
  const chartTypes: PptxGenJS.IChartMulti[] = chart.series.map((s, i) => ({
    type: s.type === 'line' ? pptx.ChartType.line : pptx.ChartType.bar,
    data: [
      {
        name: columnName(table, s.columnId),
        labels,
        values: seriesData(table, s).map((v) => v ?? 0),
      },
    ],
    options: {
      chartColors: [hex(palette[i % palette.length])],
      secondaryValAxis: usesRight && s.axis === 'yRight',
      secondaryCatAxis: usesRight && s.axis === 'yRight',
    },
  }));

  const placeholder: PptxGenJS.IChartMulti[] =
    chartTypes.length > 0
      ? chartTypes
      : [
          {
            type: pptx.ChartType.bar,
            data: [{ name: 'Series 1', labels, values: [] }],
            options: {},
          },
        ];

  const options: PptxGenJS.IChartOpts = {
    x: 0.5,
    y: 0.6,
    w: 12.3,
    h: 6.2,
    showTitle: Boolean(chart.title),
    title: chart.title || undefined,
    showLegend: true,
    legendPos: 'b',
    valAxes: usesRight
      ? [{ showValAxisTitle: false }, { showValAxisTitle: false }]
      : undefined,
    catAxes: usesRight ? [{ catAxisHidden: false }, { catAxisHidden: true }] : undefined,
  };

  // The shipped d.ts declares a legacy `addChart(type, data, opts)` signature,
  // but the runtime accepts `(IChartMulti[], opts)` for combo charts (it reads
  // `data || opt` as the options). Cast to the real combo signature.
  type AddCombo = (types: PptxGenJS.IChartMulti[], options: PptxGenJS.IChartOpts) => void;
  (slide.addChart as unknown as AddCombo)(placeholder, options);

  await pptx.writeFile({ fileName });
}
