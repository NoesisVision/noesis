import {
  Card,
  Combobox,
  createTheme,
  type CSSVariablesResolver,
  localStorageColorSchemeManager,
  Menu,
  Modal,
  Popover,
  SegmentedControl,
  Splitter,
} from '@mantine/core';
import classes from './theme.module.css';

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
  components: {
    Modal: Modal.extend({
      // Mantine fixes a modal's frame with a top and a width but no left
      // edge. In the body that edge is the screen's; portalled into the
      // shell's content while it is full screen, it is where the content's
      // padding ends, so the frame starts in from the left and runs off the
      // right. Pinned to the screen's edge, it sits where it does in the body.
      styles: { inner: { left: 0 } },
    }),
    SegmentedControl: SegmentedControl.extend({
      classNames: {
        root: classes.segmentedRoot,
        indicator: classes.segmentedIndicator,
        label: classes.segmentedLabel,
      },
    }),
    Card: Card.extend({ classNames: { root: classes.card } }),
    // Every dropdown alike: well rounded, its rows rounded inside it to
    // match, 6px in (18 - 6 = 12).
    Menu: Menu.extend({
      defaultProps: { radius: 18 },
      classNames: { dropdown: classes.dropdown, item: classes.dropdownRow },
    }),
    Combobox: Combobox.extend({
      defaultProps: { radius: 18 },
      classNames: { dropdown: classes.dropdown, option: classes.dropdownRow },
    }),
    Popover: Popover.extend({ defaultProps: { radius: 18 } }),
    // Every split the same: a gap of the page with a slim grip in it.
    Splitter: Splitter.extend({
      defaultProps: { lineSize: 18 },
      classNames: {
        handle: classes.splitterHandle,
        thumb: classes.splitterThumb,
      },
    }),
  },
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
      // The app's navigation: a tinted rail with white surfaces raised on it.
      '--noesis-rail-background': gray[1],
      '--noesis-rail-border': gray[2],
      '--noesis-rail-surface': current.white,
    },
    dark: {
      '--noesis-secondary-text': dark[1],
      '--noesis-architecture-edge': dark[2],
      '--noesis-architecture-card': dark[6],
      '--noesis-architecture-module': dark[8],
      '--noesis-architecture-module-border': brand[8],
      '--noesis-architecture-core': dark[7],
      '--noesis-architecture-core-border': brand[7],
      '--noesis-rail-background': dark[8],
      '--noesis-rail-border': dark[5],
      '--noesis-rail-surface': dark[7],
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
