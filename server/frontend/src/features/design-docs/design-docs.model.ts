import { IconPencilBolt } from '@tabler/icons-react';

/**
 * The icon a design document is drawn with, wherever it is named: the sidebar,
 * a card in the list, the heading of the page that shows one. The domain owns
 * it so a view does not have to pick an icon for what it merely renders.
 */
export const DesignDocsIcon = IconPencilBolt;

/** The ways a design document is read: as a model, as requirements, as hexagons. */
export const DESIGN_DOC_VIEWS = [
  'model',
  'requirements',
  'architecture',
] as const;
export type DesignDocViewName = (typeof DESIGN_DOC_VIEWS)[number];

export const isDesignDocView = (value: unknown): value is DesignDocViewName =>
  (DESIGN_DOC_VIEWS as readonly unknown[]).includes(value);

/**
 * What the address says about how a design document is being read: as which
 * view, which element is in hand, and what is being looked for. All are
 * optional — every existing link to this page carries none, a page without a
 * view is the model, and a link that names an element the document no longer
 * has falls back to the top of the tree.
 *
 * Each view keeps its own place: `node` and `q` are the model's, `entry` and
 * `entryQ` the requirements', `arch` and `archQ` the architecture's, so
 * switching from one to another and back returns to where the reader was in
 * each.
 */
export interface DesignDocSearch {
  view?: DesignDocViewName | undefined;
  node?: string | undefined;
  q?: string | undefined;
  /** The row of the requirements tree in hand: a need, a rule under one, a group. */
  entry?: string | undefined;
  entryQ?: string | undefined;
  /** What is in hand in the architecture: a row of its tree, or a card no row names. */
  arch?: string | undefined;
  archQ?: string | undefined;
}

const word = (value: unknown) =>
  typeof value === 'string' && value !== '' ? value : undefined;

// The model is the default, so the address names only the others.
const viewOf = (value: unknown) =>
  isDesignDocView(value) && value !== 'model' ? value : undefined;

export const designDocSearch = (
  search: Record<string, unknown>,
): DesignDocSearch => ({
  view: viewOf(search.view),
  node: word(search.node),
  q: word(search.q),
  entry: word(search.entry),
  entryQ: word(search.entryQ),
  arch: word(search.arch),
  archQ: word(search.archQ),
});
