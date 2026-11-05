import { describe, expect, it } from 'bun:test';
import { SystemModel } from '#backend/app/system-model/system-model';
import { graphOf } from '#backend/app/system-model/system-model-graph';

const model = SystemModel.parse({
  id: '01999999-0000-7000-8000-000000000001',
  name: 'shop',
  scanned_at: '2026-11-05T10:00:00.000Z',
  modules: [
    {
      id: 'module|sales',
      name: 'sales',
      relations: [
        {
          kind: 'module_contains_building_block',
          from: 'module|sales',
          to: 'building_block|sales.Order',
        },
        {
          kind: 'module_contains_building_block',
          from: 'module|sales',
          to: 'building_block|sales.Money',
        },
      ],
      source: { path: 'src/sales', line: 1 },
    },
  ],
  buildingBlocks: [
    {
      id: 'building_block|sales.Order',
      name: 'Order',
      type: 'aggregate',
      properties: [{ name: 'total', type: 'building_block|sales.Money' }],
      relations: [
        {
          kind: 'building_block_exposes_behavior',
          from: 'building_block|sales.Order',
          to: 'behavior|sales.Order.place',
        },
      ],
      source: { path: 'src/sales/Order.java', line: 1 },
    },
    {
      id: 'building_block|sales.Money',
      name: 'Money',
      type: 'value_object',
      properties: [],
      relations: [],
      source: { path: 'src/sales/Money.java', line: 1 },
    },
  ],
  behaviors: [
    {
      id: 'behavior|sales.Order.place',
      name: 'place',
      type: 'Command',
      input: [{ name: 'amount', type: 'building_block|sales.Money' }],
      output: [],
      relations: [
        {
          kind: 'behavior_invokes_behavior',
          from: 'behavior|sales.Order.place',
          to: 'behavior|sales.Order.place',
        },
      ],
      source: { path: 'src/sales/Order.java', line: 10 },
    },
  ],
});

describe('graphOf', () => {
  it('reads the model as elements, containment, uses and calls', () => {
    const graph = graphOf(model);
    expect(graph.modelId).toBe(model.id);
    expect(
      graph.elements.map(({ id, kind, type, container }) => [
        id,
        kind,
        type,
        container,
      ]),
    ).toEqual([
      ['module|sales', 'module', null, null],
      [
        'building_block|sales.Order',
        'building_block',
        'aggregate',
        'module|sales',
      ],
      [
        'building_block|sales.Money',
        'building_block',
        'value_object',
        'module|sales',
      ],
      [
        'behavior|sales.Order.place',
        'behavior',
        'Command',
        'building_block|sales.Order',
      ],
    ]);
    expect(graph.uses).toEqual([
      ['building_block|sales.Order', 'building_block|sales.Money'],
      ['behavior|sales.Order.place', 'building_block|sales.Money'],
    ]);
    // A call of itself is no call.
    expect(graph.invokes).toEqual([]);
  });
});
