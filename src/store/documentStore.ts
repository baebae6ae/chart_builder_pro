import { create } from 'zustand';
import type { Aggregation, CellValue, ChartConfig, DataTable, SeriesType, VizType } from '@/types';
import { inferColumnType, isNumeric } from '@/lib/util/infer';

/**
 * The live working document: the current dataset plus the chart bound to it.
 *
 * This is the only place the active table/chart is mutated. Components read
 * slices via selectors and call actions; they never reach in and rewrite state
 * directly, which keeps data flow one-directional and easy to follow.
 */

const emptyChart: ChartConfig = {
  title: '',
  viz: 'combo',
  xColumnId: null,
  series: [],
  agg: 'sum',
};

interface DocumentState {
  table: DataTable | null;
  chart: ChartConfig;

  /** Replace the dataset (e.g. after the import wizard) and reset the chart. */
  setTable: (table: DataTable) => void;
  /** Load a snapshot's table + chart as the new working document. */
  loadDocument: (table: DataTable, chart: ChartConfig) => void;
  clear: () => void;

  /** Edit a single grid cell; numeric columns coerce to numbers. */
  updateCell: (rowIndex: number, colIndex: number, raw: string) => void;
  renameColumn: (columnId: string, name: string) => void;
  addRow: () => void;
  deleteRow: (rowIndex: number) => void;

  setTitle: (title: string) => void;
  /** Choose the visualization type from the gallery. */
  setViz: (viz: VizType) => void;
  /** Set the aggregation used by the KPI-card visualization. */
  setAgg: (agg: Aggregation) => void;
  /** Assign a column to an axis drop zone. */
  assignAxis: (columnId: string, axis: 'x' | 'yLeft' | 'yRight') => void;
  removeSeries: (columnId: string) => void;
  setSeriesType: (columnId: string, type: SeriesType) => void;
}

const recomputeType = (table: DataTable, colIndex: number): DataTable => {
  const columns = table.columns.map((col, i) =>
    i === colIndex
      ? { ...col, type: inferColumnType(table.rows.map((r) => r[colIndex])) }
      : col,
  );
  return { ...table, columns };
};

export const useDocumentStore = create<DocumentState>((set) => ({
  table: null,
  chart: emptyChart,

  setTable: (table) => set({ table, chart: emptyChart }),
  loadDocument: (table, chart) => set({ table, chart }),
  clear: () => set({ table: null, chart: emptyChart }),

  updateCell: (rowIndex, colIndex, raw) =>
    set((state) => {
      if (!state.table) return state;
      const value: CellValue = raw === '' ? null : isNumeric(raw) ? Number(raw) : raw;
      const rows = state.table.rows.map((row, r) =>
        r === rowIndex ? row.map((cell, c) => (c === colIndex ? value : cell)) : row,
      );
      return { table: recomputeType({ ...state.table, rows }, colIndex) };
    }),

  renameColumn: (columnId, name) =>
    set((state) => {
      if (!state.table) return state;
      const columns = state.table.columns.map((col) =>
        col.id === columnId ? { ...col, name } : col,
      );
      return { table: { ...state.table, columns } };
    }),

  addRow: () =>
    set((state) => {
      if (!state.table) return state;
      const blank: CellValue[] = state.table.columns.map(() => null);
      return { table: { ...state.table, rows: [...state.table.rows, blank] } };
    }),

  deleteRow: (rowIndex) =>
    set((state) => {
      if (!state.table) return state;
      const rows = state.table.rows.filter((_, r) => r !== rowIndex);
      return { table: { ...state.table, rows } };
    }),

  setTitle: (title) => set((state) => ({ chart: { ...state.chart, title } })),
  setViz: (viz) => set((state) => ({ chart: { ...state.chart, viz } })),
  setAgg: (agg) => set((state) => ({ chart: { ...state.chart, agg } })),

  assignAxis: (columnId, axis) =>
    set((state) => {
      if (axis === 'x') {
        // X holds one column and never doubles as a value series.
        return {
          chart: {
            ...state.chart,
            xColumnId: columnId,
            series: state.chart.series.filter((s) => s.columnId !== columnId),
          },
        };
      }
      const series = state.chart.series.filter((s) => s.columnId !== columnId);
      // First series defaults to bars, the rest to lines — a sensible combo.
      const type: SeriesType = series.length === 0 ? 'bar' : 'line';
      series.push({ columnId, axis, type });
      const xColumnId = state.chart.xColumnId === columnId ? null : state.chart.xColumnId;
      return { chart: { ...state.chart, xColumnId, series } };
    }),

  removeSeries: (columnId) =>
    set((state) => ({
      chart: {
        ...state.chart,
        xColumnId: state.chart.xColumnId === columnId ? null : state.chart.xColumnId,
        series: state.chart.series.filter((s) => s.columnId !== columnId),
      },
    })),

  setSeriesType: (columnId, type) =>
    set((state) => ({
      chart: {
        ...state.chart,
        series: state.chart.series.map((s) =>
          s.columnId === columnId ? { ...s, type } : s,
        ),
      },
    })),
}));
