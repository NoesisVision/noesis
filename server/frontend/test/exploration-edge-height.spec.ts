import { describe, expect, it } from 'bun:test';
import {
  depthsOf,
  edgeHeightOver,
} from '../src/features/system-model/ui/exploration/exploration-edges';

/*
 * A shop: sales holds orders, which holds Order, which holds place; Catalog
 * is in sales alone; Clerk is in nothing.
 */
const elements = [
  { id: 'sales', parent: null },
  { id: 'orders', parent: 'sales' },
  { id: 'Order', parent: 'orders' },
  { id: 'place', parent: 'Order' },
  { id: 'Catalog', parent: 'sales' },
  { id: 'Clerk', parent: null },
];
const depthOf = depthsOf(elements);
const deepest = Math.max(...depthOf.values());
const relation = (source: string, target: string) => ({
  id: `${source}->${target}`,
  kind: 'extends' as const,
  source,
  target,
});

describe('How high an edge stands', () => {
  it('counts how deep each card is drawn, a top one 0', () => {
    expect(Object.fromEntries(depthOf)).toEqual({
      sales: 0,
      orders: 1,
      Order: 2,
      place: 3,
      Catalog: 1,
      Clerk: 0,
    });
  });

  it('stands every edge one over the deepest card, with what its ends give it', () => {
    // React Flow adds the deeper end's depth: the sum is one over place.
    for (const [source, target] of [
      ['Catalog', 'Clerk'],
      ['Order', 'Catalog'],
      ['place', 'Clerk'],
      ['Clerk', 'sales'],
    ] as const) {
      const ends = Math.max(depthOf.get(source)!, depthOf.get(target)!);
      expect(
        edgeHeightOver(relation(source, target), depthOf, deepest) + ends,
      ).toBe(deepest + 1);
    }
  });

  it('never stands an edge below one', () => {
    expect(edgeHeightOver(relation('place', 'place'), depthOf, deepest)).toBe(
      1,
    );
  });
});
