import { describe, expect, it } from 'bun:test';
import { outlineTree } from '../src/shared/ui/outline-tree';
import { outlineFixture } from './fixtures/outline.fixture';

const tree = outlineTree(outlineFixture);

describe('outlineTree', () => {
  it('takes the nodes with no parent as the tops of the tree', () => {
    expect(tree.roots.map((node) => node.path)).toEqual(['module|shop']);
  });

  it('keeps the order the server sent inside each parent', () => {
    expect(
      tree.childrenOf('module|shop.orders').map((node) => node.name),
    ).toEqual(['Orders', 'Order']);
  });

  it('reads the line from the top down to a node, the node last', () => {
    expect(tree.ancestryOf('behavior|shop.orders.Order.place')).toEqual([
      'module|shop',
      'module|shop.orders',
      'building_block|shop.orders.Order',
      'behavior|shop.orders.Order.place',
    ]);
    expect(tree.ancestryOf('module|shop')).toEqual(['module|shop']);
    expect(tree.ancestryOf('nothing|here')).toEqual([]);
  });

  it('does not promote a node whose parent never arrived', () => {
    const orphaned = outlineTree(
      outlineFixture.filter((node) => node.path !== 'module|shop.orders'),
    );
    expect(orphaned.roots.map((node) => node.path)).toEqual(['module|shop']);
    expect(orphaned.childrenOf('module|shop').map((node) => node.name)).toEqual(
      ['legacy'],
    );
  });

  it('says nothing is under a node that holds nothing', () => {
    expect(tree.childrenOf('module|shop.legacy')).toEqual([]);
  });
});
