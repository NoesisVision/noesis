import type { OutlineNode } from '../../src/shared/ui/model-tree/model-outline.ts';

const node = (over: Partial<OutlineNode> & Pick<OutlineNode, 'path'>) =>
  ({
    parentPath: null,
    elementId: over.path,
    kind: 'module',
    name: over.path,
    depth: 0,
    change: 'unchanged',
    pattern: null,
    patternLabel: null,
    hasDiagram: false,
    ...over,
  }) satisfies OutlineNode;

/*
 * A whole small model in the order it is projected in: a context nothing
 * changed, a module removed with nothing under it, a module added, and inside
 * it a repository before an aggregate — the reading order, not the alphabet —
 * with the aggregate holding a behaviour, a property and a diagram.
 */
export const outlineFixture: OutlineNode[] = [
  node({ path: 'module|shop', name: 'shop' }),
  node({
    path: 'module|shop.legacy',
    parentPath: 'module|shop',
    name: 'legacy',
    depth: 1,
    change: 'removed',
  }),
  node({
    path: 'module|shop.orders',
    parentPath: 'module|shop',
    name: 'orders',
    depth: 1,
    change: 'added',
  }),
  node({
    path: 'building_block|shop.orders.Orders',
    parentPath: 'module|shop.orders',
    kind: 'building_block',
    name: 'Orders',
    depth: 2,
    change: 'added',
    pattern: 'repository',
    patternLabel: 'repository',
  }),
  node({
    path: 'building_block|shop.orders.Order',
    parentPath: 'module|shop.orders',
    kind: 'building_block',
    name: 'Order',
    depth: 2,
    change: 'modified',
    pattern: 'aggregate',
    patternLabel: 'aggregate',
    hasDiagram: true,
  }),
  node({
    path: 'behavior|shop.orders.Order.place',
    parentPath: 'building_block|shop.orders.Order',
    kind: 'behaviour',
    name: 'place',
    depth: 3,
    change: 'added',
    pattern: 'Command',
    patternLabel: 'Command',
  }),
  node({
    path: 'building_block|shop.orders.Order#property:total',
    parentPath: 'building_block|shop.orders.Order',
    elementId: null,
    kind: 'property',
    name: 'total',
    depth: 3,
    change: 'added',
    pattern: 'Money',
    patternLabel: 'Money',
  }),
];
