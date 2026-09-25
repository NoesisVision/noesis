import { useId, useMemo } from 'react';
import { TreeItem } from './tree-item.tsx';
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

export function ModelTree({ controller, label }: ModelTreeProps) {
  const baseId = useId();
  const { tree, selected } = controller;

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
  const roots = tree.roots.filter((node) => controller.isVisible(node.path));
  // Exactly one row of the tree is in the page's tab order; the arrow keys
  // reach the rest.
  const focusPath = selected ?? roots[0]?.path ?? null;

  return (
    <ul role="tree" aria-label={label} className={classes.tree}>
      {roots.map((node) => (
        <TreeItem
          key={node.path}
          node={node}
          controller={controller}
          rowIds={rowIds}
          ancestry={ancestry}
          focusPath={focusPath}
        />
      ))}
    </ul>
  );
}
