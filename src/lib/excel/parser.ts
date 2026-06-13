import type { CellValue, ColumnMeta, DataTable, SheetMatrix } from '@/types';
import { uid } from '@/lib/util/id';
import { inferColumnType } from '@/lib/util/infer';

/**
 * Excel ingestion — pure, browser-side, no server round-trip.
 *
 * Two stages, matching the smart-parsing UX:
 *   1. `readWorkbook`  : file bytes -> raw matrices the user previews.
 *   2. `buildTable`    : (matrix + chosen header row + region) -> DataTable.
 *
 * SheetJS does the XLSX/CSV decoding; everything else here is plain data
 * shaping so it is trivial to test and reason about.
 */

/** Inclusive rectangular selection within a SheetMatrix (0-based). */
export interface Region {
  startRow: number;
  endRow: number;
  startCol: number;
  endCol: number;
}

function normaliseCell(raw: unknown): CellValue {
  if (raw === undefined || raw === null) return null;
  if (typeof raw === 'number' || typeof raw === 'string') return raw;
  if (typeof raw === 'boolean') return raw ? 'TRUE' : 'FALSE';
  if (raw instanceof Date) return raw.toISOString().slice(0, 10);
  return String(raw);
}

/**
 * Decode an uploaded workbook into one raw matrix per sheet. SheetJS is loaded
 * on demand so its ~330 kB never weighs down the initial page load — it only
 * arrives the first time a user actually imports a file.
 */
export async function readWorkbook(file: File): Promise<SheetMatrix[]> {
  const XLSX = await import('xlsx');
  const buffer = await file.arrayBuffer();
  const wb = XLSX.read(buffer, { type: 'array', cellDates: true });

  return wb.SheetNames.map((sheetName) => {
    const sheet = wb.Sheets[sheetName];
    const aoa = XLSX.utils.sheet_to_json<unknown[]>(sheet, {
      header: 1,
      defval: null,
      blankrows: false,
    });

    const width = aoa.reduce((max, row) => Math.max(max, row.length), 0);
    const cells: CellValue[][] = aoa.map((row) => {
      const padded: CellValue[] = new Array(width).fill(null);
      for (let c = 0; c < row.length; c += 1) padded[c] = normaliseCell(row[c]);
      return padded;
    });

    return { sheetName, cells };
  });
}

/** A region covering the whole matrix — the default selection. */
export function fullRegion(matrix: SheetMatrix): Region {
  const rows = matrix.cells.length;
  const cols = matrix.cells[0]?.length ?? 0;
  return {
    startRow: 0,
    endRow: Math.max(0, rows - 1),
    startCol: 0,
    endCol: Math.max(0, cols - 1),
  };
}

function uniqueName(base: string, taken: Set<string>): string {
  const name = base.trim() || 'Column';
  if (!taken.has(name)) return name;
  let i = 2;
  while (taken.has(`${name} (${i})`)) i += 1;
  return `${name} (${i})`;
}

/**
 * Structure a chosen region into a DataTable. `headerRow` is an absolute row
 * index inside the matrix; data is taken from the rows below it, clipped to the
 * selected columns. Column types are inferred from the data sample.
 */
export function buildTable(
  matrix: SheetMatrix,
  headerRow: number,
  region: Region,
): DataTable {
  const { startCol, endCol, endRow } = region;
  const headerCells = matrix.cells[headerRow] ?? [];

  const taken = new Set<string>();
  const colIndexes: number[] = [];
  const columns: ColumnMeta[] = [];

  for (let c = startCol; c <= endCol; c += 1) {
    const label = normaliseCell(headerCells[c]);
    const name = uniqueName(label === null ? `열 ${c + 1}` : String(label), taken);
    taken.add(name);
    colIndexes.push(c);
    columns.push({ id: uid('col'), name, type: 'string' });
  }

  const rows: CellValue[][] = [];
  for (let r = headerRow + 1; r <= endRow; r += 1) {
    const source = matrix.cells[r];
    if (!source) continue;
    const row = colIndexes.map((c) => source[c] ?? null);
    if (row.every((v) => v === null || v === '')) continue; // skip blank rows
    rows.push(row);
  }

  // Infer each column's type from the column slice now that rows exist.
  columns.forEach((col, c) => {
    col.type = inferColumnType(rows.map((row) => row[c]));
  });

  return { columns, rows };
}
