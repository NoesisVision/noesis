import { describe, expect, it } from 'bun:test';
import {
  detailAt,
  type DrawnElement,
  type DrawnRelation,
  type ExplorationGraph,
  graphInDetail,
} from '../src/features/system-model/system-model-exploration';

const element = (
  kind: DrawnElement['kind'],
  id: string,
  parent: string | null = null,
) => ({ id, kind, name: id, pattern: null, container: parent, parent });
const relation = (
  kind: DrawnRelation['kind'],
  source: string,
  target: string,
): DrawnRelation => ({
  id: `${kind}:${source}->${target}`,
  kind,
  source,
  target,
});

/*
 * A shop of two modules, sales holding a module of its own:
 *
 *   sales ─ orders ─ Order ─ place        payments ─ Payments ─ pay
 *         └ Catalog                       Clerk (an actor, in no module)
 *                                         Loose ─ run (a block in no module)
 */
const graph: ExplorationGraph = {
  elements: [
    element('module', 'sales'),
    element('module', 'orders', 'sales'),
    element('building_block', 'Order', 'orders'),
    element('behavior', 'place', 'Order'),
    element('building_block', 'Catalog', 'sales'),
    element('module', 'payments'),
    element('building_block', 'Payments', 'payments'),
    element('behavior', 'pay', 'Payments'),
    element('actor', 'Clerk'),
    element('building_block', 'Loose'),
    element('behavior', 'run', 'Loose'),
    element('behavior', 'alone'),
  ],
  relations: [
    relation('invokes', 'place', 'pay'),
    relation('invokes', 'place', 'run'),
    relation('collaborator', 'Order', 'Payments'),
    relation('collaborator', 'Order', 'Payments'),
    relation('collaborator', 'Order', 'Catalog'),
    relation('extends', 'Catalog', 'Payments'),
    relation('performs', 'Clerk', 'alone'),
  ],
  badges: new Map(),
  folded: new Set(),
  noOutput: new Set(),
};
const lines = (detail: Parameters<typeof graphInDetail>[1]) =>
  graphInDetail(graph, detail).relations.map(({ id }) => id);

describe('how much of the diagram is seen from how far off', () => {
  it('sees all of it close up, less below half, modules alone below a quarter', () => {
    expect([1, 0.5, 0.49, 0.25, 0.24, 0.1].map(detailAt)).toEqual([
      'all',
      'all',
      'blocks',
      'blocks',
      'modules',
      'modules',
    ]);
  });

  it('leaves all of it as it is drawn, close up', () => {
    const all = graphInDetail(graph, 'all');
    expect(all.unseen.size).toBe(0);
    expect(all.hollow.size).toBe(0);
    expect(all.relations).toBe(graph.relations);
  });

  it('takes the behaviors drawn inside a frame out of sight first, not one standing alone', () => {
    const { unseen, hollow } = graphInDetail(graph, 'blocks');
    expect([...unseen].sort()).toEqual(['pay', 'place', 'run']);
    // The blocks that held only behaviors have nothing seen inside them.
    expect([...hollow].sort()).toEqual(['Loose', 'Order', 'Payments']);
  });

  it('then all a module holds but the modules inside it', () => {
    const { unseen, hollow } = graphInDetail(graph, 'modules');
    expect([...unseen].sort()).toEqual([
      'Catalog',
      'Order',
      'Payments',
      'pay',
      'place',
      'run',
    ]);
    // Sales still shows the module inside it; the others show nothing.
    expect(hollow.has('sales')).toBeFalse();
    expect(['orders', 'payments'].every((id) => hollow.has(id))).toBeTrue();
    // What stands in no module stays.
    expect(
      ['Clerk', 'Loose', 'alone'].some((id) => unseen.has(id)),
    ).toBeFalse();
  });

  it('runs a hidden behavior’s relations from its block, and leaves the blocks’ own', () => {
    expect(lines('blocks')).toEqual([
      'invokes:Order->Payments',
      'invokes:Order->Loose',
      // Twice in the model, once on the diagram.
      'collaborator:Order->Payments',
      'collaborator:Order->Catalog',
      'extends:Catalog->Payments',
      // Seen, and in no frame: where they stand.
      'performs:Clerk->alone',
    ]);
  });

  it('runs every relation between modules once they alone are left, once a kind', () => {
    expect(lines('modules')).toEqual([
      'invokes:orders->payments',
      // In no module, Loose is still seen: the line ends on it.
      'invokes:orders->Loose',
      'collaborator:orders->payments',
      // Order and Catalog are both in sales, orders inside it: not drawn.
      'extends:sales->payments',
      'performs:Clerk->alone',
    ]);
  });
});
