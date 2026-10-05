import { useId, useLayoutEffect, useMemo, useRef, useState } from 'react';
import type { OutlineChange, OutlineNode } from './model-outline.ts';
import { CHANGE_COLOUR } from './outline-change.ts';
import { TreeItem } from './tree-item.tsx';
import {
  createTreeStore,
  type TreeActions,
  TreeActionsContext,
  type TreeSnapshot,
  TreeStoreContext,
} from './tree-store.ts';
import { useChangeColour } from './use-change-colour.ts';
import type { ModelTreeController } from './use-model-tree.ts';
import classes from './model-tree.module.css';

/*
 * A model as a tree: contexts, the modules under them, the building blocks
 * under those, and what each block is made of. The same component draws a
 * design document's outline and, in time, the scanned model's — it is given
 * nodes and a controller and knows nothing of either.
 */

export interface ModelTreeProps {
  controller: ModelTreeController;
  /** What the tree is of, for a reader who arrives at it by keyboard. */
  label: string;
}

const CHANGES = Object.keys(CHANGE_COLOUR) as OutlineChange[];
const NONE: readonly OutlineNode[] = [];

export function ModelTree({ controller, label }: ModelTreeProps) {
  const baseId = useId();
  const { tree, selected, search, isExpanded } = controller;

  /*
   * The rows hold on to one set of actions for good, and it answers with
   * whatever the controller is now: a callback that changed with every render
   * would render every row with it.
   */
  const latest = useRef(controller);
  useLayoutEffect(() => {
    latest.current = controller;
  });
  const actions = useMemo<TreeActions>(
    () => ({
      select: (path, source) => latest.current.select(path, source),
      toggle: (path) => latest.current.toggle(path),
      expand: (path) => latest.current.expand(path),
      collapse: (path) => latest.current.collapse(path),
    }),
    [],
  );

  const rowIds = useMemo(
    () =>
      new Map(
        tree.nodes.map((node, index) => [node.path, `${baseId}-${index}`]),
      ),
    [tree, baseId],
  );
  // The line from the top down to the selected row, so its rails can be lit.
  const ancestry = useMemo(
    () => new Set(selected === null ? [] : tree.ancestryOf(selected)),
    [tree, selected],
  );
  /*
   * What is left of each row's children under the query, worked out once per
   * query so a row is handed the same array until it changes.
   */
  const childrenOf = useMemo(() => {
    const { visible } = search;
    if (visible === null) return tree.childrenOf;
    const kept = new Map<string, readonly OutlineNode[]>();
    return (path: string) => {
      let children = kept.get(path);
      if (children === undefined) {
        const shown = tree.childrenOf(path).filter((c) => visible.has(c.path));
        children = shown.length === 0 ? NONE : shown;
        kept.set(path, children);
      }
      return children;
    };
  }, [tree, search]);
  // Four colours for the whole tree, not one lookup a row.
  const changeColour = useChangeColour();
  const colours = useMemo(
    () =>
      Object.fromEntries(
        CHANGES.map((change) => [change, changeColour(change)?.color]),
      ) as Record<OutlineChange, string | undefined>,
    [changeColour],
  );

  const roots = useMemo(
    () =>
      search.visible === null
        ? tree.roots
        : tree.roots.filter((node) => search.visible?.has(node.path)),
    [tree, search],
  );
  // Exactly one row of the tree is in the page's tab order; the arrow keys
  // reach the rest.
  const focusPath = selected ?? roots[0]?.path ?? null;

  const snapshot = useMemo<TreeSnapshot>(
    () => ({
      selected,
      ancestry,
      focusPath,
      isExpanded,
      childrenOf,
      tokens: search.tokens,
      matched: search.active ? search.matched : null,
      rowIds,
      colours,
    }),
    [
      selected,
      ancestry,
      focusPath,
      isExpanded,
      childrenOf,
      search,
      rowIds,
      colours,
    ],
  );
  // Made with the first snapshot, so the first render is already whole.
  const [store] = useState(() => createTreeStore(snapshot));
  useLayoutEffect(() => store.set(snapshot), [store, snapshot]);

  return (
    <TreeStoreContext value={store}>
      <TreeActionsContext value={actions}>
        <ul role="tree" aria-label={label} className={classes.tree}>
          {roots.map((node) => (
            <TreeItem key={node.path} node={node} />
          ))}
        </ul>
      </TreeActionsContext>
    </TreeStoreContext>
  );
}
