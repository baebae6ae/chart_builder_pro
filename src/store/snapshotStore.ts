import { create } from 'zustand';
import type { ChartConfig, DataTable, Snapshot } from '@/types';
import { uid } from '@/lib/util/id';

/**
 * What-if snapshots. Each snapshot is a deep, frozen copy of the working
 * document at save time, so later edits to the live document never mutate a
 * saved scenario. The compare board reads two selected ids side by side.
 */
interface SnapshotState {
  snapshots: Snapshot[];
  /** Ids chosen for the A/B split view (max two). */
  compare: [string | null, string | null];

  capture: (name: string, table: DataTable, chart: ChartConfig) => void;
  remove: (id: string) => void;
  rename: (id: string, name: string) => void;
  /** Toggle a snapshot into/out of the two compare slots. */
  toggleCompare: (id: string) => void;
}

const clone = <T,>(value: T): T =>
  typeof structuredClone === 'function'
    ? structuredClone(value)
    : JSON.parse(JSON.stringify(value));

export const useSnapshotStore = create<SnapshotState>((set) => ({
  snapshots: [],
  compare: [null, null],

  capture: (name, table, chart) =>
    set((state) => {
      const snapshot: Snapshot = {
        id: uid('snap'),
        name: name.trim() || `시나리오 ${state.snapshots.length + 1}`,
        createdAt: Date.now(),
        table: clone(table),
        chart: clone(chart),
      };
      // Auto-fill empty compare slots so a freshly saved scenario is visible.
      const compare: [string | null, string | null] = [...state.compare];
      if (!compare[0]) compare[0] = snapshot.id;
      else if (!compare[1]) compare[1] = snapshot.id;
      return { snapshots: [...state.snapshots, snapshot], compare };
    }),

  remove: (id) =>
    set((state) => ({
      snapshots: state.snapshots.filter((s) => s.id !== id),
      compare: state.compare.map((c) => (c === id ? null : c)) as [
        string | null,
        string | null,
      ],
    })),

  rename: (id, name) =>
    set((state) => ({
      snapshots: state.snapshots.map((s) => (s.id === id ? { ...s, name } : s)),
    })),

  toggleCompare: (id) =>
    set((state) => {
      const [a, b] = state.compare;
      if (a === id) return { compare: [null, b] };
      if (b === id) return { compare: [a, null] };
      if (!a) return { compare: [id, b] };
      if (!b) return { compare: [a, id] };
      return { compare: [b, id] }; // shift: drop oldest, keep newest two
    }),
}));
