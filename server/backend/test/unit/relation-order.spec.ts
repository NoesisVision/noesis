import { describe, expect, it } from 'bun:test';
import { byRelation } from '#backend/app/scanners/system-model-builders/relation-order';
import { SystemModel } from '#backend/app/system-model/system-model';

const ORDERS = 'module|sales.orders';
const ORDER = 'building_block|sales.orders.Order';
const PLACE = 'behavior|sales.orders.Order.place';
const CANCEL = 'behavior|sales.orders.Order.cancel';

const contains = {
  kind: 'module_contains_block',
  from: ORDERS,
  to: ORDER,
} as const;
const state = {
  kind: 'has_state',
  from: ORDER,
  to: 'primitive|decimal',
  name: 'total',
  cardinality: '1',
} as const;
const invokes = {
  kind: 'behavior_invokes_behavior',
  from: CANCEL,
  to: PLACE,
  order: 1,
} as const;

describe('The order of the relations of a model', () => {
  it('is by kind, holder, target, then name or order, so two builds give one file', () => {
    const parsed = SystemModel.parse({
      id: '01a0d22d-7f47-76b9-abd4-bd21d66a1d17',
      name: 'sales',
      scanned_at: '2026-01-01T00:00:00.000Z',
      modules: [{ id: ORDERS, name: 'orders', source: { path: 'src/sales' } }],
      buildingBlocks: [
        {
          id: ORDER,
          name: 'Order',
          source: { path: 'src/sales' },
          type: 'aggregate',
        },
      ],
      behaviors: [
        { id: PLACE, name: 'place', source: { path: 'src/sales' } },
        { id: CANCEL, name: 'cancel', source: { path: 'src/sales' } },
        {
          id: 'behavior|sales.orders.Order.ship',
          name: 'ship',
          source: { path: 'src/sales' },
        },
      ],
      relations: [
        { ...invokes, to: 'behavior|sales.orders.Order.ship', order: 2 },
        invokes,
        { ...state, name: 'count', to: 'primitive|integer' },
        { ...state, name: 'weight', to: 'primitive|decimal' },
        state,
        contains,
      ],
    });

    expect(
      [...parsed.relations]
        .sort(byRelation)
        .map((r) => [r.kind, r.to, 'name' in r ? r.name : '']),
    ).toEqual([
      ['behavior_invokes_behavior', PLACE, ''],
      ['behavior_invokes_behavior', 'behavior|sales.orders.Order.ship', ''],
      ['has_state', 'primitive|decimal', 'total'],
      ['has_state', 'primitive|decimal', 'weight'],
      ['has_state', 'primitive|integer', 'count'],
      ['module_contains_block', ORDER, ''],
    ]);
  });
});
