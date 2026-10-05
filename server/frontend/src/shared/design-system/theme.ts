import {
  type CSSVariablesResolver,
  createTheme,
  localStorageColorSchemeManager,
} from '@mantine/core';

/** The noesis.vision palette. */
export const theme = createTheme({
  primaryColor: 'brand',
  cursorType: 'pointer',
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

/**
 * What the views share and Mantine has no variable for, named for what each
 * is for. Every one is declared in `web-types.json` too.
 */
export const cssVariablesResolver: CSSVariablesResolver = (current) => {
  const { gray, dark, brand, red } = current.colors;
  return {
    variables: {
      // The outline a control takes under the keyboard; each says its own offset.
      '--noesis-focus-ring': '2px solid var(--mantine-color-brand-filled)',
      '--noesis-architecture-selection': 'var(--mantine-color-orange-filled)',
    },
    light: {
      // Quieter than the text, with a step more contrast than Mantine's dimmed.
      '--noesis-secondary-text': gray[7],
      '--noesis-architecture-edge': gray[6],
      '--noesis-architecture-card': current.white,
      '--noesis-architecture-module': brand[0],
      '--noesis-architecture-module-border': brand[3],
      '--noesis-architecture-core': brand[1],
      '--noesis-architecture-core-border': brand[4],
      '--noesis-requirement-quote': gray[0],
      '--noesis-requirement-gap': red[8],
    },
    dark: {
      '--noesis-secondary-text': dark[1],
      '--noesis-architecture-edge': dark[2],
      '--noesis-architecture-card': dark[6],
      '--noesis-architecture-module': dark[8],
      '--noesis-architecture-module-border': brand[8],
      '--noesis-architecture-core': dark[7],
      '--noesis-architecture-core-border': brand[7],
      '--noesis-requirement-quote': dark[6],
      '--noesis-requirement-gap': red[4],
    },
  };
};

// `index.html` reads the same key.
const COLOR_SCHEME_KEY = 'noesis.shell.colorScheme';

export const colorSchemeManager = localStorageColorSchemeManager({
  key: COLOR_SCHEME_KEY,
});
