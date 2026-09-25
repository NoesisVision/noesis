import { useCallback, useMemo, useState } from 'react';
import type { OutlineNode } from './model-outline.ts';
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
import { type ExpansionMemory, FORGETFUL } from './outline-memory.ts';
import { type OutlineSearch, searchOutline } from './outline-search.ts';
import { type OutlineTree, outlineTree } from './outline-tree.ts';

/**
 * Where a selection was made. The tree cannot tell what a page should do
 * about one — a row the reader clicked is already under their eye, while a row
 * reached from the panel beside the tree may be anywhere — so it says where
 * the move came from and leaves the page to answer for it. Not exported: the
 * two signatures it appears in are how a caller meets it, and every caller so
 * far writes the word itself.
 */
type SelectSource = 'tree' | 'detail';

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
  readonly select: (path: string, source: SelectSource) => void;
  /** Opens a row that is shut and shuts one that is open; a leaf is neither. */
  readonly toggle: (path: string) => void;
  readonly expand: (path: string) => void;
  readonly collapse: (path: string) => void;
  readonly expandAll: () => void;
  readonly collapseAll: () => void;
}

/**
 * Where the reader is and what they are looking for belong to the page, not
 * to the tree: they are in the address, so they survive a step away and come
 * back, and a link to one of them means something. The shape the tree is in
 * is the tree's own, and is remembered rather than addressed.
 */
export interface ModelTreeState {
  readonly selected: string | null;
  readonly onSelect: (path: string, source: SelectSource) => void;
  readonly query: string;
  readonly onQuery: (query: string) => void;
  readonly memory?: ExpansionMemory;
}

export function useModelTree(
  nodes: readonly OutlineNode[],
  state: ModelTreeState,
): ModelTreeController {
  const { selected, onSelect, query, onQuery, memory = FORGETFUL } = state;
  const tree = useMemo(() => outlineTree(nodes), [nodes]);
  /*
   * Whatever shape the tree was left in, the row the address names has to be
   * a row: a link into the middle of a design that opened on a closed branch
   * would show its element in the panel and nowhere in the tree.
   */
  const [expanded, setExpanded] = useState(() => {
    const shape = memory.recall() ?? defaultExpansion(tree);
    if (selected === null) return shape;
    for (const ancestor of tree.ancestryOf(selected)) {
      if (ancestor !== selected) shape.add(ancestor);
    }
    return shape;
  });
  const [shape, setShape] = useState<SearchShape>(UNTOUCHED);

  const keep = useCallback(
    (paths: Set<string>) => {
      memory.remember(paths);
      return paths;
    },
    [memory],
  );

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
        return keep(next);
      });
    },
    [search.active, keep],
  );

  const expand = useCallback((path: string) => setOpen(path, true), [setOpen]);
  const collapse = useCallback(
    (path: string) => setOpen(path, false),
    [setOpen],
  );

  const expandAll = useCallback(() => {
    if (search.active) setShape(openEverything(tree, search));
    else setExpanded(keep(expandablePaths(tree)));
  }, [tree, search, keep]);

  const collapseAll = useCallback(() => {
    if (search.active) setShape(closeToMatches(tree, search));
    else setExpanded(keep(new Set()));
  }, [tree, search, keep]);

  /*
   * Putting a query away puts the tree back as it was, plus the way down to
   * whatever the reader had reached through the search — losing sight of the
   * row you just chose is the one thing a search must not cost you.
   */
  const ask = useCallback(
    (next: string) => {
      onQuery(next);
      if (!searchIsOver(query, next)) return;
      setShape(UNTOUCHED);
      setExpanded((current) => {
        if (selected === null) return current;
        const kept = new Set(current);
        for (const ancestor of tree.ancestryOf(selected)) {
          if (ancestor !== selected) kept.add(ancestor);
        }
        return keep(kept);
      });
    },
    [query, selected, tree, onQuery, keep],
  );

  const toggle = useCallback(
    (path: string) => {
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
    select: onSelect,
    toggle,
    expand,
    collapse,
    expandAll,
    collapseAll,
  };
}

const searchIsOver = (was: string, now: string) =>
  was.trim() !== '' && now.trim() === '';
