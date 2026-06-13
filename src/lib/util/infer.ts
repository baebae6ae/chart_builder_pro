import type { CellValue, ColumnType } from '@/types';

/**
 * Column type inference and value coercion.
 *
 * The grid stores everything the user types as a string or number; these
 * helpers decide whether a column is numeric/date/text so the chart layer
 * knows which columns can sit on a value axis.
 */

const DATE_RE = /^\d{4}[-/.]\d{1,2}([-/.]\d{1,2})?$/;

/** Values that should be treated as "empty" for grouping/counting purposes. */
const BLANKISH = new Set(['', '-', '—', '–', 'n/a', 'na', 'null', 'none', '.']);

/** True when a cell carries no real information (null, empty, or a placeholder). */
export function isBlank(value: CellValue): boolean {
  if (value === null) return true;
  if (typeof value === 'string') return BLANKISH.has(value.trim().toLowerCase());
  return false;
}

/** True when a value can be treated as a finite number. */
export function isNumeric(value: CellValue): boolean {
  if (value === null || value === '') return false;
  if (typeof value === 'number') return Number.isFinite(value);
  return Number.isFinite(Number(value));
}

/** Coerce a raw cell to a number, or `null` when it is not numeric. */
export function toNumber(value: CellValue): number | null {
  if (!isNumeric(value)) return null;
  return typeof value === 'number' ? value : Number(value);
}

function looksLikeDate(value: CellValue): boolean {
  return typeof value === 'string' && DATE_RE.test(value.trim());
}

/**
 * Infer a column's type from a sample of its values. A column counts as
 * numeric/date only when the clear majority of non-empty cells qualify, so a
 * stray label does not demote an otherwise numeric column.
 */
export function inferColumnType(values: CellValue[]): ColumnType {
  const present = values.filter((v) => v !== null && v !== '');
  if (present.length === 0) return 'string';

  const numeric = present.filter(isNumeric).length;
  if (numeric / present.length >= 0.8) return 'number';

  const dates = present.filter(looksLikeDate).length;
  if (dates / present.length >= 0.8) return 'date';

  return 'string';
}
