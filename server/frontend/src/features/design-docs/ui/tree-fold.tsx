import { createContext, type RefObject, useContext } from 'react';

/**
 * The outline's way to hide itself, given by the columns that hold it to the
 * search bar above its rows: the button that hides the tree sits beside the
 * buttons that fold it, and the field it opens on again when the rail's
 * search is pressed. None where the columns are stacked, on a phone, and the
 * tree is never hidden.
 */
export interface TreeFold {
  hide: () => void;
  /** The search field, given focus when the tree is opened to search it. */
  searchRef: RefObject<HTMLInputElement | null>;
  /** The keys that hide and show the tree, as the reader's keyboard writes them. */
  shortcut: string;
}

export const TreeFoldContext = createContext<TreeFold | null>(null);

export const useTreeFold = () => useContext(TreeFoldContext);

/** ⌘\ on a Mac, Ctrl+\ elsewhere: the key the editors of code use for a sidebar. */
export const TREE_SHORTCUT =
  typeof navigator !== 'undefined' && /Mac|iP(hone|ad)/.test(navigator.platform)
    ? '⌘\\'
    : 'Ctrl+\\';

/** Whether a key press is the one that hides and shows the tree. */
export const isTreeShortcut = (event: KeyboardEvent) =>
  event.key === '\\' &&
  (event.metaKey || event.ctrlKey) &&
  !event.altKey &&
  !event.shiftKey;
