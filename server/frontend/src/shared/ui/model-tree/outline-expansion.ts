import type { OutlineSearch } from './outline-search.ts';
import type { OutlineTree } from './outline-tree.ts';

/*
 * What is open, which is two different questions. With no query it is simply
 * the set the reader has opened. Under a query the tree has been arranged for
 * them — the line down to every match is open — so what is kept is only how
 * they have since departed from that: what they opened past it and what they
 * shut. Both are thrown away when the query goes, and the set they had before
 * comes back untouched.
 */

export interface SearchShape {
  readonly opened: ReadonlySet<string>;
  readonly closed: ReadonlySet<string>;
}

export const UNTOUCHED: SearchShape = { opened: new Set(), closed: new Set() };

/** Every path with something under it: what can be opened at all. */
export function expandablePaths(tree: OutlineTree): Set<string> {
  return new Set(
    tree.nodes
      .filter((node) => tree.childrenOf(node.path).length > 0)
      .map((node) => node.path),
  );
}

/**
 * What a reader who has opened nothing sees: the modules down to the building
 * blocks they hold, and no further. That is the shape the tree is for — which
 * context, which module, what is in it — with a block's own properties, rules
 * and scenarios folded away until asked for.
 */
export function defaultExpansion(tree: OutlineTree): Set<string> {
  return new Set(
    tree.nodes
      .filter(
        (node) =>
          node.kind === 'module' && tree.childrenOf(node.path).length > 0,
      )
      .map((node) => node.path),
  );
}

/** Every path with something under it that the query has left on screen. */
export function openablePaths(
  tree: OutlineTree,
  search: OutlineSearch,
): Set<string> {
  const shown = (path: string) =>
    search.visible === null || search.visible.has(path);
  return new Set(
    tree.nodes
      .filter(
        (node) =>
          shown(node.path) &&
          tree.childrenOf(node.path).some((child) => shown(child.path)),
      )
      .map((node) => node.path),
  );
}

/** Open everything the query has left standing. */
export function openEverything(
  tree: OutlineTree,
  search: OutlineSearch,
): SearchShape {
  return { opened: openablePaths(tree, search), closed: new Set() };
}

/**
 * Shut everything back to the matches themselves. The line down to each stays
 * open, because collapsing a search must never hide what it found: the reader
 * asked which parts of the design answer, and that is what is left.
 */
export function closeToMatches(
  tree: OutlineTree,
  search: OutlineSearch,
): SearchShape {
  return {
    opened: new Set(),
    closed: new Set(
      [...search.matched].filter((path) => tree.childrenOf(path).length > 0),
    ),
  };
}

export function openIn(shape: SearchShape, path: string): SearchShape {
  return {
    opened: new Set(shape.opened).add(path),
    closed: without(shape.closed, path),
  };
}

export function closeIn(shape: SearchShape, path: string): SearchShape {
  return {
    opened: without(shape.opened, path),
    closed: new Set(shape.closed).add(path),
  };
}

function without(paths: ReadonlySet<string>, path: string): Set<string> {
  const next = new Set(paths);
  next.delete(path);
  return next;
}
