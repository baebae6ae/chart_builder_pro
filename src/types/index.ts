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

/** Render style for a value series. */
export type SeriesType = 'bar' | 'line';

/** One value series bound to a left/right Y axis. */
export interface SeriesConfig {
  columnId: string;
  axis: 'yLeft' | 'yRight';
  type: SeriesType;
}

/** Declarative description of the chart, decoupled from any rendering library. */
export interface ChartConfig {
  title: string;
  xColumnId: string | null;
  series: SeriesConfig[];
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

/** Raw matrix read straight from an uploaded sheet, before structuring. */
export interface SheetMatrix {
  sheetName: string;
  /** Full grid of raw cell values; ragged rows are padded to equal width. */
  cells: CellValue[][];
}
