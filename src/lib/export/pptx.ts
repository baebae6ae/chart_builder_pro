import type PptxGenJS from 'pptxgenjs';
import type { DataTable, ChartConfig, Theme } from '@/types';
import { buildPlotData, type PlotData } from '@/lib/chart/plotData';
import { buildReportTable } from '@/lib/chart/tableModel';
import { buildKpis } from '@/lib/chart/kpiModel';
import { vizMeta } from '@/lib/chart/registry';
import { formatCompact, formatNumber } from '@/lib/util/format';

/**
 * Native PPTX export for every visualization type.
 *
 * pptxgenjs writes real PowerPoint objects — editable chart parts, native
 * tables and text — not pictures, so the downloaded deck stays fully editable.
 * It consumes the same PlotData the screen uses (grouping/counting included), so
 * what you see is what you ship. Generation runs in the browser; nothing is
 * uploaded.
 */

const hex = (c: string) => c.replace('#', '').toUpperCase();
const colorAt = (palette: string[], i: number) => hex(palette[i % palette.length]);

const FRAME = { x: 0.5, y: 0.6, w: 12.3, h: 6.2 } as const;

export async function exportToPptx(
  table: DataTable,
  chart: ChartConfig,
  theme: Theme,
  fileName = 'chart-builder-pro.pptx',
): Promise<void> {
  // Loaded on demand: the ~385 kB pptxgenjs bundle only arrives on export.
  const { default: PptxGenJSCtor } = await import('pptxgenjs');
  const pptx = new PptxGenJSCtor();
  pptx.defineLayout({ name: 'WIDE', width: 13.33, height: 7.5 });
  pptx.layout = 'WIDE';

  const slide = pptx.addSlide();
  const palette = theme.colors.length > 0 ? theme.colors : ['#2563eb'];

  const common: PptxGenJS.IChartOpts = {
    ...FRAME,
    showTitle: Boolean(chart.title),
    title: chart.title || undefined,
    showLegend: true,
    legendPos: 'b',
  };

  const render = vizMeta(chart.viz).render;

  if (render === 'table') {
    addTitle(slide, chart);
    const model = buildReportTable(table, chart);
    const header: PptxGenJS.TableRow = model.columns.map((c) => ({
      text: c.name,
      options: {
        bold: true,
        color: 'FFFFFF',
        fill: { color: hex(palette[0]) },
        align: c.type === 'number' ? 'right' : 'left',
      },
    }));
    const body: PptxGenJS.TableRow[] = model.rows.slice(0, 40).map((row) =>
      row.map((cell, ci) => ({
        text: cell === null ? '' : typeof cell === 'number' ? formatNumber(cell) : String(cell),
        options: { align: (model.columns[ci].type === 'number' ? 'right' : 'left') as 'right' | 'left' },
      })),
    );
    slide.addTable([header, ...body], {
      x: 0.5,
      y: chart.title ? 1.0 : 0.6,
      w: 12.3,
      border: { type: 'solid', color: 'E2E6EF', pt: 1 },
      fontSize: 11,
      valign: 'middle',
      autoPage: true,
      autoPageRepeatHeader: true,
    });
  } else if (render === 'kpi') {
    addTitle(slide, chart, true);
    const cards = buildKpis(table, chart);
    const perRow = Math.min(4, Math.max(1, cards.length));
    const cardW = 2.9;
    const cardH = 1.9;
    const gap = 0.3;
    const totalW = perRow * cardW + (perRow - 1) * gap;
    const startX = (13.33 - totalW) / 2;
    cards.forEach((card, i) => {
      const col = i % perRow;
      const row = Math.floor(i / perRow);
      const x = startX + col * (cardW + gap);
      const y = 1.5 + row * (cardH + gap);
      const accent = colorAt(palette, i);
      slide.addShape(pptx.ShapeType.roundRect, {
        x, y, w: cardW, h: cardH,
        fill: { color: 'F7F9FC' },
        line: { color: accent, width: 1.5 },
        rectRadius: 0.08,
      });
      slide.addText(
        [
          { text: card.label, options: { fontSize: 13, color: '6B7280', breakLine: true } },
          { text: formatCompact(card.value), options: { fontSize: 30, bold: true, color: accent, breakLine: true } },
          { text: card.aggLabel, options: { fontSize: 11, color: '9CA3AF' } },
        ],
        { x, y, w: cardW, h: cardH, align: 'center', valign: 'middle' },
      );
    });
  } else {
    addChart(pptx, slide, buildPlotData(table, chart), chart, palette, common);
  }

  await pptx.writeFile({ fileName });
}

/** Big heading text for the non-chart (table / KPI) slides. */
function addTitle(slide: PptxGenJS.Slide, chart: ChartConfig, center = false): void {
  if (!chart.title) return;
  slide.addText(chart.title, {
    x: 0.5, y: 0.25, w: 12.3, h: 0.6,
    fontSize: center ? 24 : 20,
    bold: true,
    align: center ? 'center' : 'left',
  });
}

/** Dispatch the chart-rendered visualization types to native PPT charts. */
function addChart(
  pptx: PptxGenJS,
  slide: PptxGenJS.Slide,
  plot: PlotData,
  chart: ChartConfig,
  palette: string[],
  common: PptxGenJS.IChartOpts,
): void {
  const labels = plot.categories;
  const valuesOf = (i: number) => plot.series[i].values.map((v) => v ?? 0);

  switch (chart.viz) {
    case 'pie':
    case 'donut': {
      const s0 = plot.series[0];
      const data = [{ name: s0?.name ?? 'Series', labels, values: s0 ? valuesOf(0) : [] }];
      slide.addChart(chart.viz === 'donut' ? pptx.ChartType.doughnut : pptx.ChartType.pie, data, {
        ...common,
        chartColors: labels.map((_, i) => colorAt(palette, i)),
        holeSize: chart.viz === 'donut' ? 50 : undefined,
        showPercent: true,
      });
      return;
    }
    case 'scatter': {
      const data: { name: string; values: number[] }[] = [
        { name: plot.series[0]?.name ?? 'X', values: valuesOf(0) },
      ];
      plot.series.slice(1).forEach((s, i) => data.push({ name: s.name, values: valuesOf(i + 1) }));
      slide.addChart(pptx.ChartType.scatter, data, {
        ...common,
        chartColors: plot.series.slice(1).map((_, i) => colorAt(palette, i)),
        lineSize: 0,
      });
      return;
    }
    case 'radar': {
      const data = plot.series.map((s, i) => ({ name: s.name, labels, values: valuesOf(i) }));
      slide.addChart(pptx.ChartType.radar, data, {
        ...common,
        chartColors: plot.series.map((_, i) => colorAt(palette, i)),
        radarStyle: 'standard',
      });
      return;
    }
    default:
      addComboChart(pptx, slide, plot, palette, common, chart.viz === 'stackedBar');
  }
}

/** Combo (bar/line/area mix) and stacked bar, via pptxgenjs multi-type charts. */
function addComboChart(
  pptx: PptxGenJS,
  slide: PptxGenJS.Slide,
  plot: PlotData,
  palette: string[],
  common: PptxGenJS.IChartOpts,
  stacked: boolean,
): void {
  const labels = plot.categories;
  const usesRight = plot.series.some((s) => s.axis === 'yRight');

  const kindOf = (type: PlotData['series'][number]['type']): 'bar' | 'area' | 'line' => {
    if (stacked || type === 'bar') return 'bar';
    if (type === 'area') return 'area';
    return 'line';
  };

  // PowerPoint only clusters/stacks bar series that live in a SINGLE barChart
  // element. Emitting one entry per bar series (as we used to) makes PPT draw
  // several overlapping barCharts at the same category position — the "weird
  // shape" bug. So merge all bar series sharing an axis into one entry; lines
  // and areas overlay fine as individual entries.
  const multi: PptxGenJS.IChartMulti[] = [];

  (['yLeft', 'yRight'] as const).forEach((axis) => {
    const bars = plot.series
      .map((s, i) => ({ s, i }))
      .filter(({ s }) => kindOf(s.type) === 'bar' && s.axis === axis);
    if (bars.length === 0) return;
    const onRight = axis === 'yRight' && usesRight;
    multi.push({
      type: pptx.ChartType.bar,
      data: bars.map(({ s }) => ({ name: s.name, labels, values: s.values.map((v) => v ?? 0) })),
      options: {
        chartColors: bars.map(({ i }) => colorAt(palette, i)),
        barGrouping: stacked ? 'stacked' : 'clustered',
        secondaryValAxis: onRight,
        secondaryCatAxis: onRight,
      },
    });
  });

  plot.series.forEach((s, i) => {
    const kind = kindOf(s.type);
    if (kind === 'bar') return;
    const onRight = usesRight && s.axis === 'yRight';
    multi.push({
      type: kind === 'area' ? pptx.ChartType.area : pptx.ChartType.line,
      data: [{ name: s.name, labels, values: s.values.map((v) => v ?? 0) }],
      options: {
        chartColors: [colorAt(palette, i)],
        secondaryValAxis: onRight,
        secondaryCatAxis: onRight,
      },
    });
  });

  const placeholder: PptxGenJS.IChartMulti[] =
    multi.length > 0
      ? multi
      : [{ type: pptx.ChartType.bar, data: [{ name: 'Series 1', labels, values: [] }], options: {} }];

  const options: PptxGenJS.IChartOpts = {
    ...common,
    barGrouping: stacked ? 'stacked' : 'clustered',
    valAxes: usesRight ? [{ showValAxisTitle: false }, { showValAxisTitle: false }] : undefined,
    catAxes: usesRight ? [{ catAxisHidden: false }, { catAxisHidden: true }] : undefined,
  };

  // The shipped d.ts declares a legacy `addChart(type, data, opts)` signature,
  // but the runtime accepts `(IChartMulti[], opts)` for combo charts (it reads
  // `data || opt` as the options). Cast to the real combo signature.
  type AddCombo = (types: PptxGenJS.IChartMulti[], options: PptxGenJS.IChartOpts) => void;
  (slide.addChart as unknown as AddCombo)(placeholder, options);
}
