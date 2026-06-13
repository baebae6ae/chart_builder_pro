import type { CellValue, ChartConfig, ColumnMeta, DataTable } from '@/types';
import { buildPlotData } from '@/lib/chart/plotData';

/**
 * Report-table model. When grouping is on it shows the aggregated result
 * (dimension + measures, one row per category); otherwise it projects the raw
 * dataset down to the bound columns (or the full table when nothing is bound).
 */
export interface ReportTable {
  columns: ColumnMeta[];
  rows: CellValue[][];
}

function aggregatedTable(table: DataTable, chart: ChartConfig): ReportTable {
  const plot = buildPlotData(table, chart);
  const dimName =
    table.columns.find((c) => c.id === chart.xColumnId)?.name ?? '분류';

  const columns: ColumnMeta[] = [
    { id: '__dim', name: dimName, type: 'string' },
    ...plot.series.map((s, i) => ({ id: `__m${i}`, name: s.name, type: 'number' as const })),
  ];
  const rows: CellValue[][] = plot.categories.map((cat, r) => [
    cat,
    ...plot.series.map((s) => s.values[r] ?? null),
  ]);

  return { columns, rows };
}

function rawTable(table: DataTable, chart: ChartConfig): ReportTable {
  const selected = [chart.xColumnId, ...chart.series.map((s) => s.columnId)].filter(
    (id): id is string => Boolean(id),
  );
  const ids = selected.length > 0 ? [...new Set(selected)] : table.columns.map((c) => c.id);
  const indexes = ids
    .map((id) => table.columns.findIndex((c) => c.id === id))
    .filter((i) => i >= 0);

  return {
    columns: indexes.map((i) => table.columns[i]),
    rows: table.rows.map((row) => indexes.map((i) => row[i] ?? null)),
  };
}

export function buildReportTable(table: DataTable, chart: ChartConfig): ReportTable {
  if (chart.aggregate && chart.xColumnId) return aggregatedTable(table, chart);
  return rawTable(table, chart);
}
