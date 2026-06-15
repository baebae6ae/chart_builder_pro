/**
 * Shared domain model for Chart Builder Pro.
 *
 * These types are the single source of truth that every layer agrees on:
 *   lib/ (pure logic)  ->  store/ (state)  ->  components/ (UI)
 *
 * Nothing in here imports React or any library, so the domain model stays
 * portable and easy to reason about.
 */

/** A single cell value in the data grid. `null` represents an empty cell. */
export type CellValue = string | number | null;

/** Inferred logical type of a column, used for chart axis eligibility. */
export type ColumnType = 'number' | 'string' | 'date';

/** Metadata describing one column of the working dataset. */
export interface ColumnMeta {
  /** Stable identifier, independent of the (editable) display name. */
  id: string;
  /** Header label shown to the user. */
  name: string;
  type: ColumnType;
}

/**
 * The working dataset. Rows are stored as a dense matrix aligned to `columns`
 * (rows[r][c]) which keeps both grid editing and chart building trivial.
 */
export interface DataTable {
  columns: ColumnMeta[];
  rows: CellValue[][];
}

/** The three drop targets on the canvas. */
export type AxisKey = 'x' | 'yLeft' | 'yRight';

/** Render style for a value series within a combo chart. */
export type SeriesType = 'bar' | 'line' | 'area';

/**
 * How a measure column is reduced within a dimension group (or overall).
 * `count` ignores the column and counts rows — the key to charting purely
 * categorical data where there are no numbers to sum.
 */
export type MeasureAgg = 'count' | 'sum' | 'avg' | 'min' | 'max';

/**
 * The kind of visualization to produce from the current data binding. The same
 * dimension/measure assignment can be shown as any applicable type, which is
 * what lets one dataset yield charts, a table, or infographic cards.
 */
export type VizType =
  | 'combo' // bar / line / area mixed per series (signature drag-to-axis chart)
  | 'stackedBar'
  | 'pie'
  | 'donut'
  | 'scatter'
  | 'radar'
  | 'table'
  | 'kpi';

/**
 * One measure (value) of the chart. `columnId` is null for a pure row COUNT.
 * `agg` decides how the column collapses within each dimension group.
 */
export interface SeriesConfig {
  columnId: string | null;
  axis: 'yLeft' | 'yRight';
  type: SeriesType;
  agg: MeasureAgg;
}

/** Declarative description of the visualization, decoupled from any library. */
export interface ChartConfig {
  title: string;
  /** Selected visualization type from the gallery. */
  viz: VizType;
  /** Dimension / category column to group by (the X / label axis). */
  xColumnId: string | null;
  /** Measure columns (the values). */
  series: SeriesConfig[];
  /** When true, rows are grouped by the dimension and measures aggregated. */
  aggregate: boolean;
}

/** Corporate theme extracted from a logo or PPT template. */
export interface Theme {
  name: string;
  /** Ordered palette of hex colors applied to series. */
  colors: string[];
  fontFamily: string;
}

/** A frozen copy of the working document for what-if comparison. */
export interface Snapshot {
  id: string;
  name: string;
  createdAt: number;
  table: DataTable;
  chart: ChartConfig;
}

/** Why an auto-generated insight is interesting (drives ranking & diversity). */
export type InsightKind =
  | 'distribution' // top-N category counts
  | 'crossRollup' // melted multi-column shared-vocabulary distribution
  | 'breakdown' // numeric sum/avg by category
  | 'trend' // measure over time
  | 'correlation' // measure × measure scatter
  | 'composition' // category × subcategory, stacked
  | 'kpi' // summary cards
  | 'ranking'; // ranked table

/**
 * A self-contained, ready-to-render finding produced by the analysis engine.
 *
 * `table` + `chart` form a complete unit the existing VizRenderer/exportToPptx
 * consume unchanged. CRITICAL invariant: `chart.xColumnId` and
 * `chart.series[].columnId` reference column ids **inside `table`** (which may be
 * a derived/melted table), never the source dataset.
 */
export interface Insight {
  id: string;
  kind: InsightKind;
  /** Short headline, e.g. "유형별 분포". */
  title: string;
  /** Quantified finding sentence, e.g. "상위 3개 유형이 전체의 62%". */
  caption: string;
  /** Ranking score; higher surfaces first. */
  score: number;
  table: DataTable;
  chart: ChartConfig;
}

/** Raw matrix read straight from an uploaded sheet, before structuring. */
export interface SheetMatrix {
  sheetName: string;
  /** Full grid of raw cell values; ragged rows are padded to equal width. */
  cells: CellValue[][];
}
