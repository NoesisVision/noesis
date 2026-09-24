import { IconPencilBolt } from '@tabler/icons-react';

/**
 * The icon a design document is drawn with, wherever it is named: the sidebar,
 * a card in the list, the heading of the page that shows one. The domain owns
 * it so a view does not have to pick an icon for what it merely renders.
 */
export const DesignDocsIcon = IconPencilBolt;

/**
 * What the address says about how a design document is being read: which
 * element is in hand, and what is being looked for. Both are optional — every
 * existing link to this page carries neither, and a link that names an
 * element the document no longer has falls back to the top of the tree.
 */
export interface DesignDocSearch {
  node?: string | undefined;
  q?: string | undefined;
}

const word = (value: unknown) =>
  typeof value === 'string' && value !== '' ? value : undefined;

export const designDocSearch = (
  search: Record<string, unknown>,
): DesignDocSearch => ({ node: word(search.node), q: word(search.q) });
