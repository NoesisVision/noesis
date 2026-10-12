import { createContext, useContext, useSyncExternalStore } from 'react';
import type { OutlineChange, OutlineNode } from './model-outline.ts';
import type { SelectSource } from './use-model-tree.ts';

/*
 * What every row of the tree reads, held outside React so that a row reads
 * only its own part of it. Handed down as props, the same state re-rendered
 * every row on every click; read through here, a row renders again only when
 * what it shows has changed — the row chosen, the one left, the line between
 * them, the branch opened.
 */

export interface TreeActions {
  readonly select: (path: string, source: SelectSource) => void;
  readonly toggle: (path: string) => void;
  readonly expand: (path: string) => void;
  readonly collapse: (path: string) => void;
  /** A row is picked up to be moved. */
  readonly dragStart: (path: string) => void;
  /** Whether the row picked up may be dropped on this one; it becomes the target if so. */
  readonly dragOver: (path: string) => boolean;
  readonly drop: (path: string) => void;
  readonly dragEnd: () => void;
}

export interface TreeSnapshot {
  readonly selected: string | null;
  /** The line from the top down to the selected row, which lights its rails. */
  readonly ancestry: ReadonlySet<string>;
  /** The one row of the tree that is in the page's tab order. */
  readonly focusPath: string | null;
  readonly isExpanded: (path: string) => boolean;
  /** The same array for the same row until the tree or the query changes. */
  readonly childrenOf: (path: string) => readonly OutlineNode[];
  readonly tokens: readonly string[];
  /** Rows the query found; null when nothing is being searched. */
  readonly matched: ReadonlySet<string> | null;
  /** What names each row, so a `treeitem` is labelled by its own line alone. */
  readonly rowIds: ReadonlyMap<string, string>;
  readonly colours: Readonly<Record<OutlineChange, string | undefined>>;
  /** Whether a row may be picked up and moved; never, in a tree that moves nothing. */
  readonly canDrag: (path: string) => boolean;
  /** The row a dragged one would land in, if dropped now. */
  readonly dropPath: string | null;
}

export interface TreeStore {
  readonly get: () => TreeSnapshot;
  readonly set: (next: TreeSnapshot) => void;
  readonly subscribe: (listener: () => void) => () => void;
}

export function createTreeStore(initial: TreeSnapshot): TreeStore {
  let current = initial;
  const listeners = new Set<() => void>();
  return {
    get: () => current,
    set: (next) => {
      if (next === current) return;
      current = next;
      for (const listener of listeners) listener();
    },
    subscribe: (listener) => {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
  };
}

export const TreeStoreContext = createContext<TreeStore | null>(null);

/** Held for good by every row: they answer with whatever the tree is now. */
export const TreeActionsContext = createContext<TreeActions | null>(null);

export function useTreeActions(): TreeActions {
  const actions = useContext(TreeActionsContext);
  if (actions === null) throw new Error('A tree row outside of a ModelTree');
  return actions;
}

/**
 * One piece of the tree's state, for one row. The selector must return a
 * primitive or a reference that holds still, or the row renders every time.
 */
export function useTreeState<T>(select: (snapshot: TreeSnapshot) => T): T {
  const store = useContext(TreeStoreContext);
  if (store === null) throw new Error('A tree row outside of a ModelTree');
  const read = () => select(store.get());
  return useSyncExternalStore(store.subscribe, read, read);
}
