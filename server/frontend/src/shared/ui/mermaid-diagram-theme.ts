import type { MantineTheme } from '#/shared/design-system/hooks.ts';

/**
 * The mermaid theme variables a flowchart is painted from. Mermaid types
 * `themeVariables` as `any`, so nothing else would catch a misspelling — and a
 * misspelled variable is not an error there, it is simply ignored.
 *
 * These are the ones the node, cluster and edge styles read; the `base` theme
 * holds 227 in all, the rest belonging to gantt, pie, git, quadrant and the
 * other diagram kinds. Where a property says what it derives from, setting
 * either end works and the more specific one wins.
 *
 * The full list, and what computes what, is `updateColors()` in mermaid's
 * `base` theme (`mermaid/dist/chunks/mermaid.core/chunk-O7XYJQB3.mjs`).
 */
export interface DiagramTheme {
  /** What mermaid inverts to reach `lineColor` and `arrowheadColor`. */
  background?: string;
  /** Feeds `mainBkg`, the node fill. */
  primaryColor?: string;
  /** Feeds `nodeBorder`, the node stroke. */
  primaryBorderColor?: string;
  /** Feeds `nodeTextColor` and `textColor`. */
  primaryTextColor?: string;
  /** Feeds `edgeLabelBackground`. */
  secondaryColor?: string;
  secondaryBorderColor?: string;
  secondaryTextColor?: string;
  /** Feeds `clusterBkg`, the subgraph fill. */
  tertiaryColor?: string;
  /** Feeds `clusterBorder` and `border2`. */
  tertiaryBorderColor?: string;
  /** Feeds `titleColor`, the subgraph title. */
  tertiaryTextColor?: string;

  /** The node fill itself, past `primaryColor`. */
  mainBkg?: string;
  nodeBkg?: string;
  /** The node stroke itself, past `primaryBorderColor`. */
  nodeBorder?: string;
  nodeTextColor?: string;
  clusterBkg?: string;
  clusterBorder?: string;
  titleColor?: string;
  textColor?: string;
  border2?: string;
  flowContainerStroke?: string;

  lineColor?: string;
  arrowheadColor?: string;
  defaultLinkColor?: string;
  /** The chip drawn behind an edge's label. */
  edgeLabelBackground?: string;

  /** Mermaid's own diagram for a chart it could not parse. */
  errorBkgColor?: string;
  errorTextColor?: string;

  /** A `filter` value, or `false` for none. Not a `box-shadow`. */
  dropShadow?: string | false;
  /** The `neo` look strokes a node with a gradient while this is on. */
  useGradient?: boolean;
  /** Pixels, unitless. Mermaid's own default is 1. */
  strokeWidth?: number;
  /** Pixels, unitless. Mermaid's own default is 5. */
  radius?: number;
  fontFamily?: string;
  /** A CSS length, unlike the two above — mermaid's own default is `16px`. */
  fontSize?: string;
}

/**
 * Every colour a diagram is painted with, chosen once. Mermaid reaches its
 * nodes through theme variables and its edge labels only through CSS, so the
 * two go on to be spelled differently — but they are picked here, together,
 * and neither half holds a colour of its own.
 */
function palette(theme: MantineTheme, scheme: 'light' | 'dark') {
  const { brand, gray, dark } = theme.colors;

  if (scheme === 'dark') {
    return {
      surface: dark[7],
      nodeFill: dark[5],
      nodeStroke: brand[5],
      nodeText: dark[0],
      clusterFill: dark[6],
      clusterStroke: dark[4],
      line: dark[2],
      labelFill: dark[6],
      labelStroke: brand[5],
      labelText: dark[0],
    };
  }

  return {
    surface: gray[0],
    nodeFill: brand[0],
    nodeStroke: brand[3],
    nodeText: brand[9],
    clusterFill: gray[1],
    clusterStroke: gray[4],
    line: gray[6],
    labelFill: brand[3],
    labelStroke: brand[9],
    labelText: brand[9],
  };
}

/**
 * What mermaid paints a diagram with. Mermaid derives the colours it is not
 * given — a node's border from `primaryBorderColor`, the edges from
 * `invert(background)` — by computing on the values, so these have to be
 * colours it can read and never `var(--mantine-…)`, which is why the palette
 * is resolved rather than left to the stylesheet.
 *
 * Only the roots are set; the full list of what each one feeds is in
 * mermaid's `base` theme, which exists to be overridden this way.
 */
export function diagramTheme(
  theme: MantineTheme,
  scheme: 'light' | 'dark',
): DiagramTheme {
  const colours = palette(theme, scheme);

  return {
    background: colours.surface,
    primaryColor: colours.nodeFill,
    primaryBorderColor: colours.nodeStroke,
    primaryTextColor: colours.nodeText,
    secondaryColor: colours.labelFill,
    tertiaryColor: colours.clusterFill,
    tertiaryBorderColor: colours.clusterStroke,
    lineColor: colours.line,
    // The `neo` look strokes a node with a gradient built from the theme,
    // which at this size reads as a smudge rather than an edge. Off, mermaid
    // strokes with `nodeBorder`, the solid colour `primaryBorderColor` feeds.
    useGradient: false,
    dropShadow: asDropShadow(theme.shadows.xs),
    fontFamily: theme.fontFamily,
  };
}

/**
 * The parts of a diagram no theme variable reaches. Mermaid puts this in the
 * SVG's own `<style>`, namespaced under the diagram's id — the same place its
 * generated rules go, and *above* them, so a rule here has to outweigh the one
 * it replaces rather than merely follow it. That is what the doubled class
 * names are for; `!important` would do as well and read worse.
 *
 * The style element is inserted before the renderer draws, and a label's
 * `foreignObject` is sized from `getBoundingClientRect()` of the live element,
 * so padding added here is measured with the text and the box grows to fit
 * instead of clipping.
 *
 * No comments go in the CSS itself: mermaid parses it with
 * `CSSStyleSheet.replaceSync`, which drops them.
 */
export function diagramCss(
  theme: MantineTheme,
  scheme: 'light' | 'dark',
): string {
  const { labelFill, labelStroke, labelText } = palette(theme, scheme);

  return [
    // The chip behind an edge's label. `edgeLabelBackground` cannot paint it
    // alone: mermaid fades that colour with an alpha it hardcodes at 0.5,
    // reading only the red, green and blue off it, so an alpha handed in is
    // discarded and `transparent` comes back as half-black.
    `.labelBkg.labelBkg { background: ${labelFill}; border: 1px solid ${labelStroke}; border-radius: ${theme.radius.sm}; padding: 2px 6px; }`,
    `.edgeLabel.edgeLabel { background-color: transparent; color: ${labelText}; }`,
    '.edgeLabel.edgeLabel p { background-color: transparent; margin: 0; }',
  ].join('\n');
}

/**
 * A Mantine shadow as mermaid wants it. Mantine states elevation as
 * `box-shadow`; mermaid sets a `filter`, whose layers are `drop-shadow()`.
 * The two are not the same shape: a colour may lead or trail a layer, and
 * `drop-shadow()` has no spread, so a fourth length is dropped rather than
 * approximated — `xs`, the one shadow in the scale without one, is the only
 * one that survives this untouched.
 */
export function asDropShadow(boxShadow: string): string {
  return splitOutsideBrackets(boxShadow, /,/)
    .map(asDropShadowLayer)
    .filter((layer) => layer !== null)
    .join(' ');
}

function asDropShadowLayer(layer: string): string | null {
  const parts = splitOutsideBrackets(layer, /\s/);
  // An inset shadow is painted inside the shape, which a filter cannot do.
  if (parts.includes('inset')) return null;

  const [x, y, blur = '0'] = parts.filter(isLength);
  if (x === undefined || y === undefined) return null;

  const colour = parts.find((part) => part !== 'inset' && !isLength(part));
  return `drop-shadow(${x} ${y} ${blur}${colour ? ` ${colour}` : ''})`;
}

/**
 * Split where `separator` falls outside brackets. Both halves of a shadow
 * need it: the commas that end a layer look exactly like the ones inside
 * `rgba(…)`, and the spaces that end a part like the ones inside
 * `calc(0.0625rem * var(--mantine-scale))`, which is the shape every length
 * in a resolved Mantine theme arrives in.
 */
function splitOutsideBrackets(text: string, separator: RegExp): string[] {
  const parts: string[] = [];
  let depth = 0;
  let start = 0;
  for (let at = 0; at < text.length; at += 1) {
    const character = text[at] ?? '';
    if (character === '(') depth += 1;
    else if (character === ')') depth -= 1;
    else if (depth === 0 && separator.test(character)) {
      parts.push(text.slice(start, at));
      start = at + 1;
    }
  }
  parts.push(text.slice(start));
  return parts.map((part) => part.trim()).filter((part) => part !== '');
}

function isLength(part: string): boolean {
  return (
    part.startsWith('calc(') ||
    /^-?(?:\d+\.?\d*|\.\d+)(?:px|rem|em|%)?$/.test(part)
  );
}
