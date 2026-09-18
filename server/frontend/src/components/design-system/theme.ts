import { createTheme, localStorageColorSchemeManager } from '@mantine/core';

/**
 * The noesis.vision palette as a Mantine theme (decision D5): a cool blue
 * ramp with `blue-700` as the primary shade, Raleway, and small radii.
 * Everything else is Mantine's default.
 */
export const theme = createTheme({
  primaryColor: 'brand',
  primaryShade: { light: 7, dark: 6 },
  colors: {
    brand: [
      '#eff6ff',
      '#dbeafe',
      '#bfdbfe',
      '#93c5fd',
      '#60a5fa',
      '#3b82f6',
      '#2563eb',
      '#1d4ed8',
      '#1e40af',
      '#1e3a8a',
    ],
  },
  fontFamily:
    "'Raleway Variable', ui-sans-serif, system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif",
  headings: { fontWeight: '600' },
  defaultRadius: 'sm',
});

/** Persisted under the shell's namespace; `index.html` reads the same key. */
const COLOR_SCHEME_KEY = 'noesis.shell.colorScheme';

export const colorSchemeManager = localStorageColorSchemeManager({
  key: COLOR_SCHEME_KEY,
});
