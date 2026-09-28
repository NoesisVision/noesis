import { describe, expect, it } from 'bun:test';
import {
  closeToMatches,
  defaultExpansion,
  expandablePaths,
  openablePaths,
  openEverything,
  shapeWithWayDown,
  UNTOUCHED,
  withWayDown,
} from '../src/shared/ui/model-tree/outline-expansion';
import { searchOutline } from '../src/shared/ui/model-tree/outline-search';
import { outlineTree } from '../src/shared/ui/model-tree/outline-tree';
import { outlineFixture } from './fixtures/outline.fixture';

const tree = outlineTree(outlineFixture);
const quiet = searchOutline(tree, '');
const sorted = (paths: Iterable<string>) => [...paths].sort();

describe('expandablePaths', () => {
  it('is every node with something under it', () => {
    expect(sorted(expandablePaths(tree))).toEqual([
      'building_block|shop.orders.Order',
      'module|shop',
      'module|shop.orders',
    ]);
  });
});

describe('defaultExpansion', () => {
  it('opens the modules down to the blocks, and stops there', () => {
    expect(sorted(defaultExpansion(tree))).toEqual([
      'module|shop',
      'module|shop.orders',
    ]);
  });
});

describe('openablePaths', () => {
  it('is everything openable when nothing is being searched', () => {
    expect(sorted(openablePaths(tree, quiet))).toEqual(
      sorted(expandablePaths(tree)),
    );
  });

  it('leaves out a row whose children the query has taken away', () => {
    // `Orders` matches, and it holds nothing; the blocks' parent still does.
    expect(
      sorted(openablePaths(tree, searchOutline(tree, 'repository'))),
    ).toEqual(['module|shop', 'module|shop.orders']);
  });
});

describe('openEverything', () => {
  it('opens all that is left standing under a query, and shuts nothing', () => {
    const shape = openEverything(tree, searchOutline(tree, 'aggregate'));
    expect(sorted(shape.opened)).toEqual([
      'building_block|shop.orders.Order',
      'module|shop',
      'module|shop.orders',
    ]);
    expect(shape.closed.size).toBe(0);
  });
});

describe('closeToMatches', () => {
  it('shuts the matches themselves and leaves the way down to them open', () => {
    const search = searchOutline(tree, 'aggregate');
    const shape = closeToMatches(tree, search);
    expect(sorted(shape.closed)).toEqual(['building_block|shop.orders.Order']);
    expect(shape.opened.size).toBe(0);
    // Whatever is shut, every match is still a row the reader can see: the
    // line down to it is the search's own doing and is not touched here.
    for (const path of search.matched) {
      for (const ancestor of tree.ancestryOf(path)) {
        if (ancestor !== path) expect(shape.closed.has(ancestor)).toBe(false);
      }
    }
  });

  it('shuts nothing when what was found holds nothing', () => {
    const shape = closeToMatches(tree, searchOutline(tree, 'repository'));
    expect(shape.closed.size).toBe(0);
  });
});

describe('withWayDown', () => {
  const place = 'behavior|shop.orders.Order.place';

  it('opens every ancestor of a row, and not the row itself', () => {
    expect(sorted(withWayDown(new Set(), tree, place))).toEqual([
      'building_block|shop.orders.Order',
      'module|shop',
      'module|shop.orders',
    ]);
  });

  it('keeps what else was open', () => {
    const open = new Set(['module|shop.legacy']);
    expect(withWayDown(open, tree, place).has('module|shop.legacy')).toBe(true);
  });

  it('gives back the same set when the way down is already open', () => {
    const open = withWayDown(new Set(), tree, place);
    expect(withWayDown(open, tree, place)).toBe(open);
  });
});

describe('shapeWithWayDown', () => {
  it('opens the way down past what the query opened, and reopens what was shut', () => {
    const shut = {
      opened: new Set<string>(),
      closed: new Set(['module|shop']),
    };
    const shape = shapeWithWayDown(
      shut,
      tree,
      'behavior|shop.orders.Order.place',
    );
    expect(shape.closed.has('module|shop')).toBe(false);
    expect(sorted(shape.opened)).toEqual([
      'building_block|shop.orders.Order',
      'module|shop',
      'module|shop.orders',
    ]);
    expect(shapeWithWayDown(UNTOUCHED, tree, 'module|shop').opened.size).toBe(
      0,
    );
  });
});
