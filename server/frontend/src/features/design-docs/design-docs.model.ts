import { IconPencilBolt } from '@tabler/icons-react';

/**
 * The icon a design document is drawn with, wherever it is named: the sidebar,
 * a card in the list, the heading of the page that shows one. The domain owns
 * it so a view does not have to pick an icon for what it merely renders.
 */
export const DesignDocsIcon = IconPencilBolt;

/** The two ways a design document is read: as a model, or as requirements. */
export type DesignDocViewName = 'model' | 'requirements';

/**
 * What the address says about how a design document is being read: as which
 * view, which element is in hand, and what is being looked for. All are
 * optional — every existing link to this page carries none, a page without a
 * view is the model, and a link that names an element the document no longer
 * has falls back to the top of the tree.
 *
 * Each view keeps its own place: `node` and `q` are the model's, `entry` and
 * `entryQ` the requirements', so switching from one to the other and back
 * returns to where the reader was in each.
 */
export interface DesignDocSearch {
  view?: DesignDocViewName | undefined;
  node?: string | undefined;
  q?: string | undefined;
  /** The row of the requirements tree in hand: a need, a rule under one, a group. */
  entry?: string | undefined;
  entryQ?: string | undefined;
}

const word = (value: unknown) =>
  typeof value === 'string' && value !== '' ? value : undefined;

// The model is the default, so the address names only the other view.
const viewOf = (value: unknown) =>
  value === 'requirements' ? ('requirements' as const) : undefined;

export const designDocSearch = (
  search: Record<string, unknown>,
): DesignDocSearch => ({
  view: viewOf(search.view),
  node: word(search.node),
  q: word(search.q),
  entry: word(search.entry),
  entryQ: word(search.entryQ),
});
