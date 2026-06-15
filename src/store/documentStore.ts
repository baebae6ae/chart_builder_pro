import { create } from 'zustand';
import type { CellValue, ChartConfig, DataTable, MeasureAgg, SeriesType, VizType } from '@/types';
import { inferColumnType, isNumeric } from '@/lib/util/infer';
import type { Insight } from '@/types';
import { generateInsights } from '@/lib/analyze/insights';

/**
 * The live working document: the current dataset, the visualization bound to
 * it, and the auto-generated suggestions for that dataset.
 *
 * This is the only place the active table/chart is mutated. Components read
 * slices via selectors and call actions; they never rewrite state directly.
 */

const emptyChart: ChartConfig = {
  title: '',
  viz: 'combo',
  xColumnId: null,
  series: [],
  aggregate: true,
};

interface DocumentState {
  table: DataTable | null;
  chart: ChartConfig;
  /** Insightful visualizations auto-generated for the current table. */
  insights: Insight[];
  /** Ids of insights the user picked for compare / deck export. */
  selectedInsightIds: string[];

  /** Replace the dataset (e.g. after the import wizard) and re-analyze it. */
  setTable: (table: DataTable) => void;
  /** Load a snapshot's table + chart as the new working document. */
  loadDocument: (table: DataTable, chart: ChartConfig) => void;
  /** Open an auto-generated insight in the editor (its own table + chart). */
  applyInsight: (insight: Insight) => void;
  /** Toggle an insight in the multi-select used for compare / export. */
  toggleInsightSelected: (id: string) => void;
  clearInsightSelection: () => void;
  clear: () => void;

  /** Edit a single grid cell; numeric columns coerce to numbers. */
  updateCell: (rowIndex: number, colIndex: number, raw: string) => void;
  renameColumn: (columnId: string, name: string) => void;
  addRow: () => void;
  deleteRow: (rowIndex: number) => void;

  setTitle: (title: string) => void;
  setViz: (viz: VizType) => void;
  setAggregate: (on: boolean) => void;
  /** Assign a column to an axis drop zone. */
  assignAxis: (columnId: string, axis: 'x' | 'yLeft' | 'yRight') => void;
  removeSeries: (columnId: string) => void;
  setSeriesType: (columnId: string, type: SeriesType) => void;
  setMeasureAgg: (columnId: string, agg: MeasureAgg) => void;
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
  insights: [],
  selectedInsightIds: [],

  setTable: (table) =>
    set({ table, chart: emptyChart, insights: generateInsights(table), selectedInsightIds: [] }),
  loadDocument: (table, chart) =>
    set({ table, chart, insights: generateInsights(table), selectedInsightIds: [] }),
  // Make the insight's own (possibly derived) table+chart the working document;
  // keep the insight list intact so the user can return to the gallery.
  applyInsight: (insight) => set({ table: insight.table, chart: insight.chart }),
  toggleInsightSelected: (id) =>
    set((state) => ({
      selectedInsightIds: state.selectedInsightIds.includes(id)
        ? state.selectedInsightIds.filter((x) => x !== id)
        : [...state.selectedInsightIds, id],
    })),
  clearInsightSelection: () => set({ selectedInsightIds: [] }),
  clear: () => set({ table: null, chart: emptyChart, insights: [], selectedInsightIds: [] }),

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
  setAggregate: (on) => set((state) => ({ chart: { ...state.chart, aggregate: on } })),

  assignAxis: (columnId, axis) =>
    set((state) => {
      if (axis === 'x') {
        return {
          chart: {
            ...state.chart,
            xColumnId: columnId,
            series: state.chart.series.filter((s) => s.columnId !== columnId),
          },
        };
      }
      const series = state.chart.series.filter((s) => s.columnId !== columnId);
      const column = state.table?.columns.find((c) => c.id === columnId);
      // Numeric columns sum; non-numeric columns can only be counted.
      const agg: MeasureAgg = column?.type === 'number' ? 'sum' : 'count';
      // First series defaults to bars, the rest to lines — a sensible combo.
      const type: SeriesType = series.length === 0 ? 'bar' : 'line';
      series.push({ columnId, axis, type, agg });
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

  setMeasureAgg: (columnId, agg) =>
    set((state) => ({
      chart: {
        ...state.chart,
        series: state.chart.series.map((s) =>
          s.columnId === columnId ? { ...s, agg } : s,
        ),
      },
    })),
}));
