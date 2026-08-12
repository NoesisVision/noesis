import * as React from 'react';
import { readShellState } from '@/components/shell/shell-store';

export const THEME_STORAGE_KEY = 'theme';

// `null` means "follow the OS" — the default until the user touches the
// toggle. Storing the absence of a choice (rather than a resolved light/dark)
// keeps the ui in step with a system theme that changes later.
export type ThemeChoice = 'light' | 'dark' | null;
export type ResolvedTheme = 'light' | 'dark';

export interface ThemeContextValue {
  choice: ThemeChoice;
  theme: ResolvedTheme;
  setTheme: (choice: ThemeChoice) => void;
  toggleTheme: () => void;
}

export const ThemeContext = React.createContext<ThemeContextValue | null>(null);

export function readThemeChoice(): ThemeChoice {
  const stored = readShellState<ThemeChoice>(THEME_STORAGE_KEY, null);
  return stored === 'light' || stored === 'dark' ? stored : null;
}

export function prefersDarkTheme(): boolean {
  return window.matchMedia('(prefers-color-scheme: dark)').matches;
}

export function useTheme(): ThemeContextValue {
  const context = React.useContext(ThemeContext);
  if (!context) throw new Error('useTheme must be used within a ThemeProvider');
  return context;
}
