import type { CellValue, ChartConfig, ColumnMeta, DataTable } from '@/types';

/**
 * Report-table model. Projects the working dataset down to the columns the user
 * bound (dimension + measures), in binding order. With nothing bound it falls
 * back to the full table. Pure data shaping — the view just renders the result.
 */
export interface ReportTable {
  columns: ColumnMeta[];
  rows: CellValue[][];
}

export function buildReportTable(table: DataTable, chart: ChartConfig): ReportTable {
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
