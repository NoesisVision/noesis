import type { OutlineNode } from '#backend/app/model-outline/model-outline.ts';

/*
 * The outline arrives flat and in reading order, because that is the shape
 * that survives the wire. A reader needs it by parent, so the relations are
 * grouped once here and the tree is rendered from them; the order inside each
 * group is the order the server sent, never re-sorted.
 */

export interface OutlineTree {
  /** As served: pre-order, already in reading order. */
  readonly nodes: readonly OutlineNode[];
  readonly byPath: ReadonlyMap<string, OutlineNode>;
  readonly roots: readonly OutlineNode[];
  readonly childrenOf: (path: string) => readonly OutlineNode[];
  /** Root first, the node itself last. Empty when the path is not in the tree. */
  readonly ancestryOf: (path: string) => readonly string[];
}

const NONE: readonly OutlineNode[] = [];

export function outlineTree(nodes: readonly OutlineNode[]): OutlineTree {
  const byPath = new Map(nodes.map((node) => [node.path, node]));
  const children = new Map<string, OutlineNode[]>();
  const roots: OutlineNode[] = [];

  for (const node of nodes) {
    if (node.parentPath === null) {
      roots.push(node);
      continue;
    }
    // A node whose parent did not arrive is unreachable rather than a root:
    // showing it at the top would claim a place the design never gave it.
    if (!byPath.has(node.parentPath)) continue;
    const siblings = children.get(node.parentPath);
    if (siblings) siblings.push(node);
    else children.set(node.parentPath, [node]);
  }

  return {
    nodes,
    byPath,
    roots,
    childrenOf: (path) => children.get(path) ?? NONE,
    ancestryOf: (path) => {
      const line: string[] = [];
      for (
        let node = byPath.get(path);
        node !== undefined;
        node =
          node.parentPath === null ? undefined : byPath.get(node.parentPath)
      ) {
        line.unshift(node.path);
      }
      return line;
    },
  };
}

/** Every path with something under it: what can be expanded at all. */
export function expandablePaths(tree: OutlineTree): Set<string> {
  return new Set(
    tree.nodes
      .filter((node) => tree.childrenOf(node.path).length > 0)
      .map((node) => node.path),
  );
}

/**
 * What a reader who has expanded nothing sees: the modules down to the
 * building blocks they hold, and no further. That is the shape the tree is
 * for — which context, which module, what is in it — with a block's own
 * properties, rules and scenarios left folded away until asked for.
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
