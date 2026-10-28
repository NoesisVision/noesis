import {
  ActionIcon,
  alpha,
  Button,
  Card,
  Checkbox,
  CheckboxIndicator,
  CloseButton,
  Combobox,
  createTheme,
  type CSSVariablesResolver,
  localStorageColorSchemeManager,
  Menu,
  Modal,
  Popover,
  Radio,
  SegmentedControl,
  Splitter,
  Switch,
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
    // Every button and icon button alike: rounded a step more than the
    // default, between the inputs' corners and the 12px dropdown rows.
    Button: Button.extend({ defaultProps: { radius: 'md' } }),
    ActionIcon: ActionIcon.extend({ defaultProps: { radius: 'md' } }),
    CloseButton: CloseButton.extend({ defaultProps: { radius: 'md' } }),
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
    Checkbox: Checkbox.extend({ classNames: { input: classes.choiceInput } }),
    CheckboxIndicator: CheckboxIndicator.extend({
      classNames: { indicator: classes.choiceInput },
    }),
    Radio: Radio.extend({ classNames: { radio: classes.choiceInput } }),
    Switch: Switch.extend({
      classNames: { input: classes.switchInput, track: classes.switchTrack },
    }),
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
      // The diagrams' accent: what is in hand, and what it reaches.
      '--noesis-diagram-selection': 'var(--mantine-color-brand-5)',
    },
    light: {
      // Quieter than the text, with a step more contrast than Mantine's dimmed.
      '--noesis-secondary-text': gray[7],
      '--noesis-architecture-edge': gray[6],
      // Every diagram's surfaces, the exploration's and the architecture's:
      // white cards on a hairline; a module a frame of the faintest blue, a
      // building block (or a domain core) a shade more, so the two read apart.
      '--noesis-diagram-card': current.white,
      '--noesis-diagram-card-border': gray[3],
      '--noesis-diagram-module': alpha(brand[0], 0.4),
      '--noesis-diagram-module-border': brand[2],
      '--noesis-diagram-block': alpha(brand[0], 0.6),
      '--noesis-diagram-block-border': brand[2],
      '--noesis-requirement-quote': gray[0],
      '--noesis-requirement-gap': red[8],
      // The app's navigation: a tinted rail with white surfaces raised on it.
      '--noesis-rail-background': gray[1],
      '--noesis-rail-border': gray[2],
      '--noesis-rail-surface': current.white,
      // The brand book's navy and cyan, the mark's two colours.
      '--noesis-brand-mark': '#2b2d3c',
    },
    dark: {
      ...softLightVariant(current),
      '--noesis-secondary-text': dark[1],
      '--noesis-architecture-edge': dark[2],
      '--noesis-diagram-card': dark[6],
      '--noesis-diagram-card-border': dark[4],
      '--noesis-diagram-module': alpha(brand[7], 0.06),
      // A frame's edge holds 3:1 against its own fill, or it is lost in the
      // dark: brand 5 on a module's tint, brand 6 on a building block's grey.
      '--noesis-diagram-module-border': brand[5],
      // In the dark, a step under the cards it holds, so they stand off it.
      '--noesis-diagram-block': alpha(dark[7], 0.95),
      '--noesis-diagram-block-border': brand[6],
      '--noesis-rail-background': dark[8],
      '--noesis-rail-border': dark[5],
      '--noesis-rail-surface': dark[7],
      '--noesis-brand-mark': '#7ee3e8',
      '--noesis-requirement-quote': dark[6],
      '--noesis-requirement-gap': red[4],
    },
  };
};

/**
 * The `light` variant in the dark — a badge, a light button, an active nav
 * row, an icon tile — as a wash of the colour over the page with a pale ink.
 * Mantine 9 paints it as shade 9 darkened by half instead, a deep saturated
 * block that sinks into the dark surfaces around it rather than standing on
 * them. Every colour of the theme alike, so no view has to correct it.
 */
function softLightVariant(theme: Parameters<CSSVariablesResolver>[0]) {
  return Object.fromEntries(
    Object.entries(theme.colors).flatMap(([name, shades]) => [
      [`--mantine-color-${name}-light`, alpha(shades[4], 0.15)],
      [`--mantine-color-${name}-light-hover`, alpha(shades[4], 0.22)],
      [`--mantine-color-${name}-light-color`, shades[2]],
    ]),
  );
}

// `index.html` reads the same key.
const COLOR_SCHEME_KEY = 'noesis.shell.colorScheme';

export const colorSchemeManager = localStorageColorSchemeManager({
  key: COLOR_SCHEME_KEY,
});
