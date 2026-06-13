import { create } from 'zustand';
import type { Theme } from '@/types';
import { DEFAULT_THEME, extractTheme } from '@/lib/theme/extractColors';

/**
 * Global corporate theme. It is intentionally a separate, app-wide store: the
 * CI palette/font applies to the live chart, every snapshot, and the exported
 * deck alike, so there is exactly one source of truth for "the company look".
 */
interface ThemeState {
  theme: Theme;
  status: 'idle' | 'extracting' | 'error';
  /** Extract a theme from an uploaded logo image or PPT template. */
  applyFromFile: (file: File) => Promise<void>;
  setColor: (index: number, hex: string) => void;
  reset: () => void;
}

export const useThemeStore = create<ThemeState>((set) => ({
  theme: DEFAULT_THEME,
  status: 'idle',

  applyFromFile: async (file) => {
    set({ status: 'extracting' });
    try {
      const theme = await extractTheme(file);
      set({ theme, status: 'idle' });
    } catch {
      set({ status: 'error' });
    }
  },

  setColor: (index, hex) =>
    set((state) => {
      const colors = [...state.theme.colors];
      colors[index] = hex;
      return { theme: { ...state.theme, colors } };
    }),

  reset: () => set({ theme: DEFAULT_THEME, status: 'idle' }),
}));
