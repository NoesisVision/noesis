import { cyberarch } from './cyberarch/index.ts';
import type { DiagramTheme } from './diagram-theme.ts';
import { flat } from './flat/index.ts';
import { isometric } from './isometric/index.ts';

/*
 * The ways the exploration's diagram can be drawn, in the order the Dev
 * Tools page lists them (diagram-theme-choice.tsx); the first is the one a
 * reader starts with.
 *
 * A theme is a folder of its own here, and this list is all that knows of
 * it. To add one:
 *
 * 1. Make `<name>/index.ts`, exporting a `DiagramTheme`: an `id` (kept in
 *    the reader's storage, so never changed once out), its `label`, the
 *    `className` of its stylesheet's root, and, if the canvas behind should
 *    change, a `background` (React Flow's `<Background>` props).
 * 2. Make `<name>/<name>.module.css`, every rule under its root,
 *    `.theme[data-diagram-theme]`. That root sits on the canvas (never
 *    the toolbar above it, which stays the app's own), so its
 *    custom properties reach every part: `--edge-uses`, `--edge-invokes` and
 *    `--edge-highlight` recolour the relations and their arrows.
 * 3. Add it to the list below.
 *
 * A theme's stylesheet cannot name the exploration's own classes, so it
 * reaches the diagram's parts by their `data-part` (element-node.tsx):
 * `blank` (the canvas before anything is drawn, which React Flow's
 * background does not reach) and `start` (the way to start, over it),
 * `card`, `holder` (what a card sits in), `container` (a frame others are
 * drawn inside), `frame-top` and `frame-label` (its top and its name),
 * `contains` (the round plus on a border), `face` (a value object's
 * bevelled face) and `bevel-ring` (its related ring). Each part also says
 * what it draws, to be told apart: `data-kind` (module, building_block,
 * behaviour), `data-pattern` (value_object, aggregate…) and `data-state`
 * (selected, related, path). Relations are React Flow's own
 * `.react-flow__edge`, reached with `:global(…)`. On the canvas too: `add`
 * (the round plus) and `visibility` (the visibility panel).
 *
 * What floats over the canvas is drawn at the page's end, outside that
 * root, so it carries the theme itself (`useThemedSurface`, in
 * diagram-theme-context.ts): it is a root and a part at once, reached as
 * `.theme[data-diagram-theme][data-part='…']` — `menu` (a card's menus),
 * `picker` (what the plus opens), `quick-add` (a right click on the
 * canvas) and `tooltip`. A new surface over the canvas takes the hook.
 *
 * The root and a part weigh as the exploration's own rules for that part
 * do, with one attribute more, so a theme wins over them wherever both
 * speak — keep that shape, and a theme never fights the plain look.
 */
export const THEMES = [
  flat,
  isometric,
  cyberarch,
] as const satisfies readonly DiagramTheme[];

export type DiagramThemeId = (typeof THEMES)[number]['id'];

export const DEFAULT_THEME = THEMES[0];
