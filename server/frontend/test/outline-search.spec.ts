import { describe, expect, it } from 'bun:test';
import {
  searchOutline,
  searchTokens,
} from '../src/shared/ui/model-tree/outline-search';
import { outlineTree } from '../src/shared/ui/model-tree/outline-tree';
import { outlineFixture } from './fixtures/outline.fixture';

const tree = outlineTree(outlineFixture);
const found = (query: string) => [...searchOutline(tree, query).matched].sort();
const shown = (query: string) =>
  [...(searchOutline(tree, query).visible ?? [])].sort();

describe('searchTokens', () => {
  it('reads a query and a stored pattern the same way', () => {
    expect(searchTokens('  Application_Service ')).toEqual([
      'application',
      'service',
    ]);
    expect(searchTokens('   ')).toEqual([]);
  });
});

describe('searchOutline', () => {
  it('searches nothing until it is asked something', () => {
    const quiet = searchOutline(tree, '  ');
    expect(quiet.active).toBe(false);
    expect(quiet.visible).toBeNull();
  });

  it('finds every row whose name holds the words, of whatever kind', () => {
    expect(found('orders')).toEqual([
      'building_block|shop.orders.Orders',
      'module|shop.orders',
    ]);
  });

  it('finds every row of a pattern, spelled either way', () => {
    expect(found('repository')).toEqual(['building_block|shop.orders.Orders']);
    expect(found('aggregate')).toEqual(['building_block|shop.orders.Order']);
  });

  it('never finds a property: the tree has no row for one', () => {
    expect(found('total')).toEqual([]);
  });

  it('wants every word, anywhere in the row, and asks of that row alone', () => {
    expect(found('place command')).toEqual([
      'behavior|shop.orders.Order.place',
    ]);
    expect(found('place nonsense')).toEqual([]);
    // The name searched is the row's own; a behaviour is not found by the
    // block that holds it, or every row under a match would be one too.
    expect(found('order place')).toEqual([]);
  });

  it('keeps the whole line down to a match', () => {
    expect(shown('place')).toEqual([
      'behavior|shop.orders.Order.place',
      'building_block|shop.orders.Order',
      'module|shop',
      'module|shop.orders',
    ]);
  });

  it('opens the line down to a match, but not the match itself', () => {
    const { opened } = searchOutline(tree, 'place');
    expect([...opened].sort()).toEqual([
      'building_block|shop.orders.Order',
      'module|shop',
      'module|shop.orders',
    ]);
    expect(opened.has('behavior|shop.orders.Order.place')).toBe(false);
  });

  it('keeps what a match holds, so opening one shows its contents', () => {
    expect(shown('aggregate')).toEqual([
      'behavior|shop.orders.Order.place',
      'building_block|shop.orders.Order',
      'module|shop',
      'module|shop.orders',
    ]);
  });

  it('leaves out a branch that holds no match', () => {
    expect(shown('place')).not.toContain('module|shop.legacy');
    expect(shown('place')).not.toContain('building_block|shop.orders.Orders');
  });
});
