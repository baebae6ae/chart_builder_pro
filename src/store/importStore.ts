import { create } from 'zustand';
import type { SheetMatrix } from '@/types';
import { readWorkbook, fullRegion, buildTable, type Region } from '@/lib/excel/parser';
import { useDocumentStore } from '@/store/documentStore';

/**
 * Transient state for the smart-parsing import wizard. Kept separate from the
 * committed document so the raw preview, header-row pick and region drag can be
 * cancelled cleanly without ever touching the live dataset until "확인".
 */
interface ImportState {
  open: boolean;
  sheets: SheetMatrix[];
  activeSheet: number;
  headerRow: number;
  region: Region | null;
  status: 'idle' | 'reading' | 'error';

  loadFile: (file: File) => Promise<void>;
  selectSheet: (index: number) => void;
  setHeaderRow: (row: number) => void;
  setRegion: (region: Region) => void;
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
  status: 'idle' as const,
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
        region: first ? fullRegion(first) : null,
        status: 'idle',
      });
    } catch {
      set({ status: 'error' });
    }
  },

  selectSheet: (index) =>
    set((state) => {
      const sheet = state.sheets[index];
      return {
        activeSheet: index,
        headerRow: 0,
        region: sheet ? fullRegion(sheet) : null,
      };
    }),

  setHeaderRow: (row) => set({ headerRow: row }),
  setRegion: (region) => set({ region }),

  cancel: () => set({ ...initial }),

  confirm: () => {
    const { sheets, activeSheet, headerRow, region } = getState();
    const sheet = sheets[activeSheet];
    if (!sheet || !region) return;
    const table = buildTable(sheet, headerRow, region);
    useDocumentStore.getState().setTable(table);
    set({ ...initial });
  },
}));
