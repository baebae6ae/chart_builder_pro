import type { DataTable } from '@/types';
import { isBlank } from '@/lib/util/infer';

/**
 * Column profiling — the first thing we do with any uploaded table. It decides
 * what each column is *good for*, which drives both auto-suggestions and the
 * drag-and-drop hints. This is what makes the app work on arbitrary files
 * rather than one expected shape.
 *
 *   measure   — numeric; can be summed/averaged on a value axis
 *   date      — a time axis; good dimension for trends
 *   dimension — low-cardinality category; good for grouping / counting
 *   text      — high-cardinality free text (descriptions, ids); poor for charts
 */
export type ColumnRole = 'measure' | 'date' | 'dimension' | 'text';

export interface ColumnProfile {
  columnId: string;
  name: string;
  role: ColumnRole;
  /** Distinct non-blank values. */
  distinct: number;
  /** Non-blank value count. */
  nonNull: number;
}

export function profileColumns(table: DataTable): ColumnProfile[] {
  const rowCount = table.rows.length;

  return table.columns.map((col, c) => {
    const present = table.rows.map((r) => r[c]).filter((v) => !isBlank(v));
    const distinct = new Set(present.map((v) => String(v))).size;

    let role: ColumnRole;
    if (col.type === 'number') {
      role = 'measure';
    } else if (col.type === 'date') {
      role = 'date';
    } else {
      // A categorical column is one with repeated, low-cardinality values; a
      // column where (almost) every row is unique reads as free text.
      const lowCardinality =
        distinct >= 2 && distinct <= 50 && distinct <= Math.max(2, rowCount * 0.6);
      role = lowCardinality ? 'dimension' : 'text';
    }

    return { columnId: col.id, name: col.name, role, distinct, nonNull: present.length };
  });
}
