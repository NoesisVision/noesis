import * as React from 'react';
import {
  clearShellState,
  writeShellState,
} from '@/components/shell/shell-store';
import {
  prefersDarkTheme,
  type ResolvedTheme,
  readThemeChoice,
  THEME_STORAGE_KEY,
  type ThemeChoice,
  ThemeContext,
  type ThemeContextValue,
} from '@/components/shell/use-theme';

// The Claude theme ships both palettes; the `dark` class on <html> picks one
// (see the `dark` custom variant in index.css).
function applyTheme(theme: ResolvedTheme): void {
  document.documentElement.classList.toggle('dark', theme === 'dark');
  document.documentElement.style.colorScheme = theme;
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [choice, setChoiceState] = React.useState<ThemeChoice>(readThemeChoice);
  const [systemTheme, setSystemTheme] = React.useState<ResolvedTheme>(() =>
    prefersDarkTheme() ? 'dark' : 'light',
  );

  React.useEffect(() => {
    const media = window.matchMedia('(prefers-color-scheme: dark)');
    const onChange = () => setSystemTheme(media.matches ? 'dark' : 'light');
    media.addEventListener('change', onChange);
    return () => media.removeEventListener('change', onChange);
  }, []);

  const theme = choice ?? systemTheme;

  // Layout effect so the class lands before the browser paints the new tree.
  React.useLayoutEffect(() => applyTheme(theme), [theme]);

  const setTheme = React.useCallback((next: ThemeChoice) => {
    setChoiceState(next);
    if (next === null) clearShellState(THEME_STORAGE_KEY);
    else writeShellState(THEME_STORAGE_KEY, next);
  }, []);

  const value = React.useMemo<ThemeContextValue>(
    () => ({
      choice,
      theme,
      setTheme,
      toggleTheme: () => setTheme(theme === 'dark' ? 'light' : 'dark'),
    }),
    [choice, theme, setTheme],
  );

  return <ThemeContext value={value}>{children}</ThemeContext>;
}
