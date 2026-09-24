import { useCallback, useMemo, useState } from 'react';
import type { OutlineNode } from '#backend/app/model-outline/model-outline.ts';
import {
  defaultExpansion,
  type OutlineTree,
  outlineTree,
} from './outline-tree.ts';

/**
 * What the tree is currently showing. The outline itself never changes while
 * a document is open, so everything here is the reader's own doing: what they
 * have opened and what they are looking at.
 */
export interface ModelTreeController {
  readonly tree: OutlineTree;
  readonly selected: string | null;
  readonly selectedNode: OutlineNode | null;
  /* Plain function properties, not methods: they are closures over the
     controller's state and are meant to be pulled off it and passed on. */
  readonly isExpanded: (path: string) => boolean;
  /** Selects the row, and opens or closes it when it has something under it. */
  readonly open: (path: string) => void;
  readonly select: (path: string) => void;
  readonly expand: (path: string) => void;
  readonly collapse: (path: string) => void;
}

export function useModelTree(
  nodes: readonly OutlineNode[],
): ModelTreeController {
  const tree = useMemo(() => outlineTree(nodes), [nodes]);
  const [expanded, setExpanded] = useState(() => defaultExpansion(tree));
  const [selected, setSelected] = useState<string | null>(
    () => tree.roots[0]?.path ?? null,
  );

  const setOpen = useCallback((path: string, open: boolean) => {
    setExpanded((current) => {
      if (current.has(path) === open) return current;
      const next = new Set(current);
      if (open) next.add(path);
      else next.delete(path);
      return next;
    });
  }, []);

  const expand = useCallback((path: string) => setOpen(path, true), [setOpen]);
  const collapse = useCallback(
    (path: string) => setOpen(path, false),
    [setOpen],
  );

  /*
   * One hit area per row, so the row is both the thing you open and the thing
   * you read: a treeitem may not hold a control of its own without becoming
   * two tab stops, and a chevron beside it would be exactly that.
   */
  const open = useCallback(
    (path: string) => {
      setSelected(path);
      if (tree.childrenOf(path).length > 0) {
        setOpen(path, !expanded.has(path));
      }
    },
    [tree, expanded, setOpen],
  );

  return {
    tree,
    selected,
    selectedNode:
      selected === null ? null : (tree.byPath.get(selected) ?? null),
    isExpanded: (path) => expanded.has(path),
    open,
    select: setSelected,
    expand,
    collapse,
  };
}
