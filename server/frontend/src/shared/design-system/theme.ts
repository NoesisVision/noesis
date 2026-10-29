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
 * The diagrams' shapes, the exploration's and the architecture's alike, in
 * pixels: a card's corners and a frame's, rounder as a panel is; how far a
 * value object's corners are cut; and how far out of a card its related
 * ring runs (to the middle of its line). Also the `--noesis-diagram-*`
 * shape tokens below, for the stylesheets; `BevelRing` draws from these.
 */
export const DIAGRAM_SHAPE = {
  cardRadius: 12,
  frameRadius: 16,
  bevel: 12,
  ringOut: 4,
} as const;

/** The diagrams' accent in the dark: the ink of the brand's light variant. */
const DIAGRAM_ACCENT_DARK = 'var(--mantine-color-brand-light-color)';

/**
 * What the views share and Mantine has no variable for, named for what each
 * is for. Every one is declared in `web-types.json` too.
 */
export const cssVariablesResolver: CSSVariablesResolver = (current) => {
  const { gray, dark, brand, red } = current.colors;
  const edges = relationEdgeTokens(current);
  return {
    variables: {
      // The outline a control takes under the keyboard; each says its own offset.
      '--noesis-focus-ring': '2px solid var(--mantine-color-brand-filled)',
      // The diagrams' one rule for a selection: what has nothing to do with
      // it steps back to this, a card or a frame, and a line further still.
      '--noesis-diagram-dimmed': '0.3',
      '--noesis-diagram-edge-dimmed': '0.2',
      // Their shapes (DIAGRAM_SHAPE), and a card's lift, more under the pointer.
      '--noesis-diagram-card-radius': `${DIAGRAM_SHAPE.cardRadius}px`,
      '--noesis-diagram-frame-radius': `${DIAGRAM_SHAPE.frameRadius}px`,
      '--noesis-diagram-bevel': `${DIAGRAM_SHAPE.bevel}px`,
      '--noesis-diagram-card-shadow': '0 1px 3px rgba(16, 24, 40, 0.06)',
      '--noesis-diagram-card-shadow-raised':
        '0 4px 12px rgba(16, 24, 40, 0.08), 0 1px 3px rgba(16, 24, 40, 0.06)',
      ...edges.variables,
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
      '--noesis-diagram-card-border-hover': gray[4],
      '--noesis-diagram-module': alpha(brand[0], 0.4),
      '--noesis-diagram-module-border': brand[2],
      '--noesis-diagram-block': alpha(brand[0], 0.6),
      '--noesis-diagram-block-border': brand[2],
      // What is not designed: a caller, an adapter.
      '--noesis-diagram-external': current.white,
      // The diagrams' accent: what is in hand, its ring, and what it reaches.
      '--noesis-diagram-selection': brand[5],
      '--noesis-diagram-selection-ring': brand[1],
      '--noesis-diagram-related': brand[3],
      // The selection's own relations, drawn over the rest.
      '--noesis-diagram-highlight': brand[6],
      // A relation's word sits on a small pill; the pill of the selection's
      // own in its tint. Each kind's own look is in RELATION_EDGES.
      ...edges.light,
      '--noesis-diagram-edge-label': current.white,
      '--noesis-diagram-edge-label-border': gray[3],
      '--noesis-diagram-edge-highlight-label': brand[0],
      '--noesis-diagram-edge-highlight-label-border': brand[3],
      '--noesis-diagram-edge-highlight-word': brand[7],
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
      // The diagrams in the dark: each frame a see-through wash of near
      // black, so a frame inside another is a step darker, as the light's
      // washes of blue deepen; the cards a grey over them on a hairline. A
      // module edged in the pale blue the app's light variant writes in, a
      // building block in grey, what is not designed a flat grey; the
      // accent the same pale blue. A frame's edge holds 3:1 against what it
      // bounds.
      '--noesis-diagram-card': dark[6],
      '--noesis-diagram-card-border': dark[4],
      '--noesis-diagram-card-border-hover': dark[3],
      '--noesis-diagram-module': alpha(dark[9], 0.3),
      '--noesis-diagram-module-border': DIAGRAM_ACCENT_DARK,
      '--noesis-diagram-block': alpha(dark[9], 0.3),
      '--noesis-diagram-block-border': dark[2],
      '--noesis-diagram-external': dark[4],
      '--noesis-diagram-selection': DIAGRAM_ACCENT_DARK,
      '--noesis-diagram-selection-ring': `rgb(from ${DIAGRAM_ACCENT_DARK} r g b / 0.25)`,
      '--noesis-diagram-related': `rgb(from ${DIAGRAM_ACCENT_DARK} r g b / 0.7)`,
      '--noesis-diagram-highlight': DIAGRAM_ACCENT_DARK,
      ...edges.dark,
      '--noesis-diagram-edge-label': dark[7],
      '--noesis-diagram-edge-label-border': dark[4],
      '--noesis-diagram-edge-highlight-label': dark[6],
      '--noesis-diagram-edge-highlight-label-border': `rgb(from ${DIAGRAM_ACCENT_DARK} r g b / 0.7)`,
      '--noesis-diagram-edge-highlight-word': DIAGRAM_ACCENT_DARK,
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
 * How each kind of relation is drawn on the exploration, all of it here: its
 * line (and arrow) and its word, in the light and in the dark, and its
 * dashes when the edges run — a dash and a gap in pixels of the line, and
 * the seconds they take to move one length along. What an element uses
 * reads as a dependency resting: a soft blue in short dots drifting slowly;
 * what it invokes as a call going: violet in long dashes moving fast. A
 * quiet line may have a word of a stronger ink. Its arrow's shape is the
 * canvas's to draw (EDGE_ARROW in relation-colors.ts).
 */
function relationEdges({ colors: { brand, violet } }: MantineThemeOf) {
  return {
    uses: {
      line: { light: brand[4], dark: '#5a7aa3' },
      word: { light: brand[9], dark: brand[2] },
      dash: 3,
      gap: 4,
      seconds: 0.7,
    },
    invokes: {
      line: { light: violet[6], dark: violet[2] },
      word: { light: violet[6], dark: violet[2] },
      dash: 10,
      gap: 5,
      seconds: 0.35,
    },
  };
}

/** The relations' looks as tokens: `--noesis-diagram-edge-<kind>[-word|-dash|-gap|-time]`. */
function relationEdgeTokens(theme: MantineThemeOf) {
  const tokens = {
    variables: {} as Record<string, string>,
    light: {} as Record<string, string>,
    dark: {} as Record<string, string>,
  };
  for (const [kind, look] of Object.entries(relationEdges(theme))) {
    const name = `--noesis-diagram-edge-${kind}`;
    tokens.light[name] = look.line.light;
    tokens.dark[name] = look.line.dark;
    tokens.light[`${name}-word`] = look.word.light;
    tokens.dark[`${name}-word`] = look.word.dark;
    tokens.variables[`${name}-dash`] = `${look.dash}px`;
    tokens.variables[`${name}-gap`] = `${look.gap}px`;
    tokens.variables[`${name}-time`] = `${look.seconds}s`;
  }
  return tokens;
}

type MantineThemeOf = Parameters<CSSVariablesResolver>[0];

/**
 * The `light` variant in the dark — a badge, a light button, an active nav
 * row, an icon tile — as a wash of the colour over the page with a pale ink.
 * Mantine 9 paints it as shade 9 darkened by half instead, a deep saturated
 * block that sinks into the dark surfaces around it rather than standing on
 * them. Every colour of the theme alike, so no view has to correct it.
 */
function softLightVariant(theme: MantineThemeOf) {
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
