import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { basename } from 'node:path';
import { DummySourceCodeScanner } from '#backend/adapters/out/scanners/dummy.scanner';
import { ChangeId } from '#backend/app/changes/change-id';
import type {
  DesignDocumentInput,
  DesignedBehaviourInput,
  DesignedBuildingBlockInput,
  DesignedDomainModuleInput,
} from '#backend/app/design-docs/design-doc';
import {
  PrimitiveId,
  ScannedBehaviour,
  ScannedBuildingBlock,
  ScannedDomainModule,
} from '#backend/app/system-model/system-model';
import { NOW, type TestNoesis, testNoesis } from './test-noesis';

const SALES = ChangeId.parse('2026-01-01-sales');
const BILLING = ChangeId.parse('2026-02-01-billing');

const salesModule: DesignedDomainModuleInput = {
  id: 'module|sales',
  name: { value: 'sales' },
  description: { value: 'Selling to customers.' },
};

const orderBlock: DesignedBuildingBlockInput = {
  id: 'building_block|sales.Order',
  name: { value: 'Order' },
  type: { value: 'aggregate' },
  description: { value: 'What a customer buys.' },
  properties: {
    added: [
      {
        name: 'total',
        type: { value: 'primitive|decimal' },
        description: { value: 'The sum of its lines.' },
        optional: { value: false },
      },
    ],
  },
};

const placeBehaviour: DesignedBehaviourInput = {
  id: 'behavior|sales.Order.place',
  name: { value: 'place' },
  type: { value: 'Command' },
  description: { value: 'Places the order.' },
  visibility: { value: { kind: 'public', actors: ['customer'] } },
  input: { added: ['primitive|uuid'] },
};

let t: TestNoesis;
let scanner: DummySourceCodeScanner;

beforeEach(async () => {
  t = await testNoesis();
  scanner = new DummySourceCodeScanner({
    noesis: t.noesis,
    changes: t.changesRepository,
    designDocs: t.designDocsRepository,
    now: () => NOW,
  });
  await t.writeChange(SALES);
  await t.writeChange(BILLING);
});

afterEach(() => t.cleanup());

/** An implemented design, stamped at `implementedAt`. */
async function implemented(
  change: ChangeId,
  id: string,
  implementedAt: string | null,
  design: Partial<DesignDocumentInput>,
): Promise<void> {
  await t.writeDesignDoc(change, {
    id,
    name: id,
    description: '',
    implemented: true,
    implementedAt,
    ...design,
  });
}

const sourceOf = (change: ChangeId, id: string) => ({
  path: `.noesis/graph/changes/${change}/${id}.design-doc.json`,
  line: null,
});

async function descriptionOf(id: string) {
  const { buildingBlocks } = await scanner.scan();
  return buildingBlocks.find((block) => block.id === id)?.description;
}

describe('The dummy scanner', () => {
  it('finds an empty model named after the repository before any design is implemented', async () => {
    await t.writeDesignDoc(SALES, {
      id: '2026-01-01-draft',
      name: 'Draft',
      description: '',
      modules: { added: [salesModule] },
    });

    expect(await scanner.scan()).toEqual({
      name: basename(t.root),
      scanned_at: NOW,
      modules: [],
      buildingBlocks: [],
      behaviours: [],
    });
  });

  it('finds what an implemented design adds, sourced at that design', async () => {
    await implemented(SALES, '2026-01-01-orders', null, {
      modules: { added: [salesModule] },
      buildingBlocks: { added: [orderBlock] },
      behaviours: { added: [placeBehaviour] },
    });
    const source = sourceOf(SALES, '2026-01-01-orders');

    const model = await scanner.scan();

    expect(model.modules).toEqual([
      ScannedDomainModule.parse({
        id: 'module|sales',
        name: 'sales',
        description: 'Selling to customers.',
        source,
      }),
    ]);
    expect(model.buildingBlocks).toEqual([
      ScannedBuildingBlock.parse({
        id: 'building_block|sales.Order',
        name: 'Order',
        type: 'aggregate',
        description: 'What a customer buys.',
        implements: [],
        properties: [
          {
            name: 'total',
            type: 'primitive|decimal',
            description: 'The sum of its lines.',
            optional: false,
          },
        ],
        rules: [],
        scenarios: [],
        source,
      }),
    ]);
    expect(model.behaviours).toEqual([
      ScannedBehaviour.parse({
        id: 'behavior|sales.Order.place',
        buildingBlockId: 'building_block|sales.Order',
        name: 'place',
        type: 'Command',
        description: 'Places the order.',
        visibility: { kind: 'public', actors: ['customer'] },
        input: ['primitive|uuid'],
        output: [],
        rules: [],
        scenarios: [],
        source,
      }),
    ]);
  });

  it('applies a later design over an earlier one: what it changes, at every level, and nothing else', async () => {
    await implemented(SALES, '2026-01-01-orders', null, {
      buildingBlocks: { added: [orderBlock] },
    });
    await implemented(BILLING, '2026-02-01-billing', NOW, {
      buildingBlocks: {
        modified: [
          {
            id: 'building_block|sales.Order',
            description: { value: 'What a customer pays for.' },
            properties: {
              removed: ['total'],
              added: [
                {
                  name: 'lines',
                  type: {
                    value: { collectionOf: 'building_block|sales.OrderLine' },
                  },
                  description: { value: 'What is bought.' },
                  optional: { value: false },
                },
              ],
            },
            rules: {
              added: [
                {
                  name: 'Never empty',
                  ruleType: { value: 'Consistency' },
                  description: { value: 'An order has a line.' },
                },
              ],
            },
          },
        ],
      },
    });

    const [order] = (await scanner.scan()).buildingBlocks;

    expect(order).toMatchObject({
      name: 'Order',
      type: 'aggregate',
      description: 'What a customer pays for.',
      properties: [
        {
          name: 'lines',
          type: { collectionOf: 'building_block|sales.OrderLine' },
        },
      ],
      rules: [{ name: 'Never empty', ruleType: 'Consistency', scenarios: [] }],
      source: sourceOf(BILLING, '2026-02-01-billing'),
    });
  });

  it('replays designs in the order they were marked implemented, across changes, those marked before the time was kept first', async () => {
    const describing = (description: string) => ({
      buildingBlocks: {
        modified: [
          {
            id: 'building_block|sales.Order',
            description: { value: description },
          },
        ],
      },
    });
    await implemented(SALES, '2026-01-10-last', '2026-05-01T00:00:00.000Z', {
      ...describing('last'),
    });
    await implemented(
      BILLING,
      '2026-01-20-middle',
      '2026-04-01T00:00:00.000Z',
      {
        ...describing('middle'),
      },
    );
    await implemented(BILLING, '2026-03-01-first', null, {
      buildingBlocks: { added: [orderBlock] },
    });

    expect(await descriptionOf('building_block|sales.Order')).toBe('last');
  });

  it('takes one of two equal references out when a design removes it', async () => {
    await implemented(SALES, '2026-01-01-orders', null, {
      buildingBlocks: { added: [orderBlock] },
      behaviours: {
        added: [
          {
            ...placeBehaviour,
            input: { added: ['primitive|string', 'primitive|string'] },
          },
        ],
      },
    });
    await implemented(SALES, '2026-01-02-narrower', NOW, {
      behaviours: {
        modified: [
          {
            id: 'behavior|sales.Order.place',
            input: { removed: ['primitive|string'] },
          },
        ],
      },
    });

    const [place] = (await scanner.scan()).behaviours;

    expect(place?.input).toEqual([PrimitiveId.parse('primitive|string')]);
  });
});

describe('Removing an element in the dummy scanner', () => {
  const billingModule: DesignedDomainModuleInput = {
    id: 'module|billing',
    name: { value: 'billing' },
    description: { value: 'Charging customers.' },
  };
  const ordersModule: DesignedDomainModuleInput = {
    id: 'module|sales.orders',
    name: { value: 'orders' },
    description: { value: 'Orders.' },
  };
  const nestedOrder: DesignedBuildingBlockInput = {
    ...orderBlock,
    id: 'building_block|sales.orders.Order',
  };
  const nestedPlace: DesignedBehaviourInput = {
    ...placeBehaviour,
    id: 'behavior|sales.orders.Order.place',
  };

  beforeEach(async () => {
    await implemented(SALES, '2026-01-01-sales', null, {
      modules: { added: [salesModule, ordersModule, billingModule] },
      buildingBlocks: { added: [nestedOrder] },
      behaviours: { added: [nestedPlace] },
    });
  });

  it('removes a module with the modules in it and everything they hold', async () => {
    await implemented(SALES, '2026-01-02-no-sales', NOW, {
      modules: { removed: ['module|sales'] },
    });

    expect(await scanner.scan()).toMatchObject({
      modules: [{ id: 'module|billing' }],
      buildingBlocks: [],
      behaviours: [],
    });
  });

  it('removes a building block with its behaviours', async () => {
    await implemented(SALES, '2026-01-02-no-orders', NOW, {
      buildingBlocks: { removed: ['building_block|sales.orders.Order'] },
    });

    const model = await scanner.scan();

    expect(model.modules).toHaveLength(3);
    expect(model.buildingBlocks).toEqual([]);
    expect(model.behaviours).toEqual([]);
  });

  it('takes a design removing a module and, by name, what it holds', async () => {
    await implemented(SALES, '2026-01-02-no-sales', NOW, {
      modules: { removed: ['module|sales', 'module|sales.orders'] },
      buildingBlocks: { removed: ['building_block|sales.orders.Order'] },
      behaviours: { removed: ['behavior|sales.orders.Order.place'] },
    });

    expect((await scanner.scan()).modules).toMatchObject([
      { id: 'module|billing' },
    ]);
  });
});

describe('A design the dummy scanner cannot flatten', () => {
  const failure = (path: string, problem: string) =>
    `Cannot flatten the implemented design document 2026-01-02-second of change ${SALES}: ${path} ${problem}.`;

  beforeEach(async () => {
    await implemented(SALES, '2026-01-01-first', null, {
      modules: { added: [salesModule] },
      buildingBlocks: { added: [orderBlock] },
    });
  });

  it('adds an element that is already there', async () => {
    await implemented(SALES, '2026-01-02-second', NOW, {
      modules: { added: [salesModule] },
    });

    await expect(scanner.scan()).rejects.toThrow(
      failure('modules.added[module|sales]', 'is already there'),
    );
  });

  it('modifies a part that is not there', async () => {
    await implemented(SALES, '2026-01-02-second', NOW, {
      buildingBlocks: {
        modified: [
          {
            id: 'building_block|sales.Order',
            properties: {
              modified: [{ name: 'discount', description: { value: 'Off.' } }],
            },
          },
        ],
      },
    });

    await expect(scanner.scan()).rejects.toThrow(
      failure(
        'buildingBlocks.modified[building_block|sales.Order].properties.modified[discount]',
        'is not there',
      ),
    );
  });

  it('removes an element that is not there', async () => {
    await implemented(SALES, '2026-01-02-second', NOW, {
      behaviours: { removed: ['behavior|sales.Order.cancel'] },
    });

    await expect(scanner.scan()).rejects.toThrow(
      failure(
        'behaviours.removed[behavior|sales.Order.cancel]',
        'is not there',
      ),
    );
  });

  it('adds an element with a field left unchanged', async () => {
    await implemented(SALES, '2026-01-02-second', NOW, {
      modules: {
        added: [{ id: 'module|billing', name: { value: 'billing' } }],
      },
    });

    await expect(scanner.scan()).rejects.toThrow(
      failure('modules.added[module|billing].description', 'has no value'),
    );
  });
});
