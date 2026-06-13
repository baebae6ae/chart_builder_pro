import { create } from 'zustand';
import type { SheetMatrix } from '@/types';
import {
  readWorkbook,
  fullRegion,
  buildTable,
  transposeMatrix,
  type Region,
} from '@/lib/excel/parser';
import { useDocumentStore } from '@/store/documentStore';

/**
 * Transient state for the smart-parsing import wizard. Kept separate from the
 * committed document so the raw preview, header-row pick, region drag and
 * orientation toggle can be cancelled cleanly without ever touching the live
 * dataset until "확인".
 */
interface ImportState {
  open: boolean;
  sheets: SheetMatrix[];
  activeSheet: number;
  headerRow: number;
  region: Region | null;
  /** Whether the active sheet is read transposed (series in rows). */
  transpose: boolean;
  status: 'idle' | 'reading' | 'error';

  loadFile: (file: File) => Promise<void>;
  selectSheet: (index: number) => void;
  setHeaderRow: (row: number) => void;
  setRegion: (region: Region) => void;
  toggleTranspose: () => void;
  /** The active sheet with the current orientation applied (for preview). */
  effectiveMatrix: () => SheetMatrix | null;
  cancel: () => void;
  /** Structure the current selection and push it into the document store. */
  confirm: () => void;
}

const initial = {
  open: false,
  sheets: [] as SheetMatrix[],
  activeSheet: 0,
  headerRow: 0,
  region: null as Region | null,
  transpose: false,
  status: 'idle' as const,
};

const oriented = (sheet: SheetMatrix | undefined, transpose: boolean): SheetMatrix | null => {
  if (!sheet) return null;
  return transpose ? transposeMatrix(sheet) : sheet;
};

export const useImportStore = create<ImportState>((set, getState) => ({
  ...initial,

  loadFile: async (file) => {
    set({ status: 'reading', open: true });
    try {
      const sheets = await readWorkbook(file);
      const first = sheets[0];
      set({
        sheets,
        activeSheet: 0,
        headerRow: 0,
        transpose: false,
        region: first ? fullRegion(first) : null,
        status: 'idle',
      });
    } catch {
      set({ status: 'error' });
    }
  },

  selectSheet: (index) =>
    set((state) => {
      const sheet = oriented(state.sheets[index], state.transpose);
      return {
        activeSheet: index,
        headerRow: 0,
        region: sheet ? fullRegion(sheet) : null,
      };
    }),

  setHeaderRow: (row) => set({ headerRow: row }),
  setRegion: (region) => set({ region }),

  toggleTranspose: () =>
    set((state) => {
      const transpose = !state.transpose;
      const sheet = oriented(state.sheets[state.activeSheet], transpose);
      // Orientation changes the coordinate system, so reset the selection.
      return { transpose, headerRow: 0, region: sheet ? fullRegion(sheet) : null };
    }),

  effectiveMatrix: () => {
    const { sheets, activeSheet, transpose } = getState();
    return oriented(sheets[activeSheet], transpose);
  },

  cancel: () => set({ ...initial }),

  confirm: () => {
    const { headerRow, region } = getState();
    const sheet = getState().effectiveMatrix();
    if (!sheet || !region) return;
    const table = buildTable(sheet, headerRow, region);
    useDocumentStore.getState().setTable(table);
    set({ ...initial });
  },
}));
