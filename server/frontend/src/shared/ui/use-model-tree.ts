import { useCallback, useMemo, useState } from 'react';
import type { OutlineNode } from '#backend/app/model-outline/model-outline.ts';
import {
  closeIn,
  closeToMatches,
  defaultExpansion,
  expandablePaths,
  openEverything,
  openIn,
  type SearchShape,
  UNTOUCHED,
} from './outline-expansion.ts';
import { type OutlineSearch, searchOutline } from './outline-search.ts';
import { type OutlineTree, outlineTree } from './outline-tree.ts';

/**
 * What the tree is currently showing. The outline itself never changes while
 * a document is open, so everything here is the reader's own doing: what they
 * have opened, what they are looking for, and what they are looking at.
 */
export interface ModelTreeController {
  readonly tree: OutlineTree;
  readonly selected: string | null;
  readonly selectedNode: OutlineNode | null;
  readonly query: string;
  readonly search: OutlineSearch;
  /* Plain function properties, not methods: they are closures over the
     controller's state and are meant to be pulled off it and passed on. */
  readonly ask: (query: string) => void;
  readonly isExpanded: (path: string) => boolean;
  readonly isVisible: (path: string) => boolean;
  /** Selects the row, and opens or closes it when it has something under it. */
  readonly open: (path: string) => void;
  readonly select: (path: string) => void;
  readonly expand: (path: string) => void;
  readonly collapse: (path: string) => void;
  readonly expandAll: () => void;
  readonly collapseAll: () => void;
}

export function useModelTree(
  nodes: readonly OutlineNode[],
): ModelTreeController {
  const tree = useMemo(() => outlineTree(nodes), [nodes]);
  const [expanded, setExpanded] = useState(() => defaultExpansion(tree));
  const [selected, setSelected] = useState<string | null>(
    () => tree.roots[0]?.path ?? null,
  );
  const [query, setQuery] = useState('');
  const [shape, setShape] = useState<SearchShape>(UNTOUCHED);

  const search = useMemo(() => searchOutline(tree, query), [tree, query]);

  const isExpanded = useCallback(
    (path: string) => {
      if (!search.active) return expanded.has(path);
      if (shape.closed.has(path)) return false;
      return search.opened.has(path) || shape.opened.has(path);
    },
    [search, shape, expanded],
  );

  const setOpen = useCallback(
    (path: string, open: boolean) => {
      if (search.active) {
        setShape((current) =>
          open ? openIn(current, path) : closeIn(current, path),
        );
        return;
      }
      setExpanded((current) => {
        if (current.has(path) === open) return current;
        const next = new Set(current);
        if (open) next.add(path);
        else next.delete(path);
        return next;
      });
    },
    [search.active],
  );

  const expand = useCallback((path: string) => setOpen(path, true), [setOpen]);
  const collapse = useCallback(
    (path: string) => setOpen(path, false),
    [setOpen],
  );

  const expandAll = useCallback(() => {
    if (search.active) setShape(openEverything(tree, search));
    else setExpanded(expandablePaths(tree));
  }, [tree, search]);

  const collapseAll = useCallback(() => {
    if (search.active) setShape(closeToMatches(tree, search));
    else setExpanded(new Set());
  }, [tree, search]);

  /*
   * Putting a query away puts the tree back as it was, plus the way down to
   * whatever the reader had reached through the search — losing sight of the
   * row you just chose is the one thing a search must not cost you.
   */
  const ask = useCallback(
    (next: string) => {
      setQuery(next);
      if (searchIsOver(query, next)) {
        setShape(UNTOUCHED);
        setExpanded((current) => {
          if (selected === null) return current;
          const kept = new Set(current);
          for (const ancestor of tree.ancestryOf(selected)) {
            if (ancestor !== selected) kept.add(ancestor);
          }
          return kept;
        });
      }
    },
    [query, selected, tree],
  );

  /*
   * One hit area per row, so the row is both the thing you open and the thing
   * you read: a treeitem may not hold a control of its own without becoming
   * two tab stops, and a chevron beside it would be exactly that.
   */
  const open = useCallback(
    (path: string) => {
      setSelected(path);
      if (tree.childrenOf(path).length > 0) setOpen(path, !isExpanded(path));
    },
    [tree, setOpen, isExpanded],
  );

  return {
    tree,
    selected,
    selectedNode:
      selected === null ? null : (tree.byPath.get(selected) ?? null),
    query,
    search,
    ask,
    isExpanded,
    isVisible: (path) => search.visible === null || search.visible.has(path),
    open,
    select: setSelected,
    expand,
    collapse,
    expandAll,
    collapseAll,
  };
}

const searchIsOver = (was: string, now: string) =>
  was.trim() !== '' && now.trim() === '';
