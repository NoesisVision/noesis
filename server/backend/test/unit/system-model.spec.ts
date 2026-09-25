import { describe, expect, it } from 'bun:test';
import { z } from 'zod';
import {
  BuildingBlockRef,
  PrimitiveId,
  ScannedScenario,
  SystemModel,
} from '#backend/app/system-model/system-model';

/*
 * The system model is what a scanner found in the code of one unit: its
 * modules, building blocks and behaviours. A design document is a diff
 * against it.
 */

const ORDER = 'building_block|sales.orders.Order';
const PLACE = 'behavior|sales.orders.Order.place';

const module = {
  id: 'module|sales.orders',
  name: 'orders',
  source: { path: 'src/sales/orders' },
};
const block = {
  id: ORDER,
  name: 'Order',
  type: 'aggregate',
  source: { path: 'src/sales/orders/order.ts', line: 12 },
};
const behaviour = {
  id: PLACE,
  buildingBlockId: ORDER,
  name: 'place',
  type: 'Command',
  visibility: { kind: 'public', actors: ['Customer'] },
  source: { path: 'src/sales/orders/order.ts', line: 30 },
};

const model = (patch: Record<string, unknown> = {}) => ({
  id: '01a0d22d-7f47-76b9-abd4-bd21d66a1d17',
  name: 'shop',
  scanned_at: '2026-09-25T08:00:00.000Z',
  modules: [module],
  buildingBlocks: [block],
  behaviours: [behaviour],
  ...patch,
});

const withBlock = (patch: Record<string, unknown>) =>
  model({ buildingBlocks: [{ ...block, ...patch }] });
const withBehaviour = (patch: Record<string, unknown>) =>
  model({ behaviours: [{ ...behaviour, ...patch }] });

const isValid = (value: unknown) => SystemModel.safeParse(value).success;

describe('A system model', () => {
  it('records which unit was scanned and when', () => {
    expect(isValid(model())).toBe(true);
    expect(isValid(model({ id: undefined }))).toBe(false);
    expect(isValid(model({ name: undefined }))).toBe(false);
    expect(isValid(model({ scanned_at: undefined }))).toBe(false);
  });

  it('holds no element when the scanner found none', () => {
    const parsed = SystemModel.parse(
      model({
        modules: undefined,
        buildingBlocks: undefined,
        behaviours: undefined,
      }),
    );

    expect(parsed.modules).toEqual([]);
    expect(parsed.buildingBlocks).toEqual([]);
    expect(parsed.behaviours).toEqual([]);
  });

  it('refuses a key it does not know, so nothing a scanner wrote is lost', () => {
    expect(isValid(model({ scanner: 'ts' }))).toBe(false);
    expect(isValid(model({ modules: [{ ...module, parent: null }] }))).toBe(
      false,
    );
    expect(isValid(withBlock({ rules: [] }))).toBe(false);
    expect(
      isValid(withBlock({ source: { path: 'order.ts', column: 4 } })),
    ).toBe(false);
    expect(
      isValid(
        withBlock({
          properties: [
            { name: 'total', type: 'primitive|decimal', nullable: true },
          ],
        }),
      ),
    ).toBe(false);
    expect(isValid(withBehaviour({ scenarios: [] }))).toBe(false);
  });

  it('reads back exactly as the scanner wrote it, with every default spelled out', () => {
    const parsed = SystemModel.parse(model());
    const written = z.encode(SystemModel, parsed);

    expect(SystemModel.parse(written)).toEqual(parsed);
    expect(written.modules?.[0]).toEqual({
      ...module,
      description: null,
      source: { path: 'src/sales/orders', line: null },
    });
  });
});

describe('A scanned element', () => {
  it('always says where in the code it was found', () => {
    expect(
      isValid(model({ modules: [{ ...module, source: undefined }] })),
    ).toBe(false);
    expect(isValid(withBlock({ source: undefined }))).toBe(false);
    expect(isValid(withBehaviour({ source: undefined }))).toBe(false);
  });

  it('names the line it starts on, counting from 1, when the scanner knows it', () => {
    expect(isValid(withBlock({ source: { path: 'order.ts' } }))).toBe(true);
    expect(isValid(withBlock({ source: { path: 'order.ts', line: 1 } }))).toBe(
      true,
    );
    expect(isValid(withBlock({ source: { path: 'order.ts', line: 0 } }))).toBe(
      false,
    );
  });

  it('has a description only when the code gives one', () => {
    const parsed = SystemModel.parse(model());

    expect(parsed.modules[0]?.description).toBe(null);
    expect(parsed.buildingBlocks[0]?.description).toBe(null);
    expect(parsed.behaviours[0]?.description).toBe(null);
  });

  it('is named by an id of its own kind', () => {
    expect(isValid(model({ modules: [{ ...module, id: ORDER }] }))).toBe(false);
    expect(isValid(withBlock({ id: 'module|sales.orders' }))).toBe(false);
    expect(isValid(withBehaviour({ id: ORDER }))).toBe(false);
  });
});

describe('A scanned building block', () => {
  it('is always classified, by one of the known types', () => {
    expect(isValid(withBlock({ type: undefined }))).toBe(false);
    expect(isValid(withBlock({ type: 'controller' }))).toBe(false);
  });

  it('lists the building blocks it implements and its properties', () => {
    const parsed = SystemModel.parse(
      withBlock({
        implements: ['building_block|sales.shared.Auditable'],
        properties: [{ name: 'total', type: 'primitive|decimal' }],
      }),
    );
    const scanned = parsed.buildingBlocks[0]!;

    expect<string[]>(scanned.implements).toEqual([
      'building_block|sales.shared.Auditable',
    ]);
    expect(scanned.properties.map((p) => p.name)).toEqual(['total']);
    expect(SystemModel.parse(model()).buildingBlocks[0]?.implements).toEqual(
      [],
    );
  });
});

describe('A scanned property', () => {
  const withProperty = (property: Record<string, unknown>) =>
    withBlock({ properties: [{ name: 'total', ...property }] });

  it('always has a type', () => {
    expect(isValid(withProperty({ type: 'primitive|decimal' }))).toBe(true);
    expect(isValid(withProperty({}))).toBe(false);
  });

  it('is required unless the code marks it optional', () => {
    const parsed = SystemModel.parse(
      withProperty({ type: 'primitive|decimal' }),
    );

    expect(parsed.buildingBlocks[0]?.properties[0]?.optional).toBe(false);
  });
});

describe('A scanned behaviour', () => {
  it('belongs to a building block', () => {
    expect(isValid(withBehaviour({ buildingBlockId: undefined }))).toBe(false);
    expect(isValid(withBehaviour({ buildingBlockId: PLACE }))).toBe(false);
  });

  it('is always classified as a command, an event or a query', () => {
    expect(isValid(withBehaviour({ type: 'Query' }))).toBe(true);
    expect(isValid(withBehaviour({ type: undefined }))).toBe(false);
    expect(isValid(withBehaviour({ type: 'Request' }))).toBe(false);
  });

  it('says nothing about a public behaviour beyond the actors it names', () => {
    expect(
      isValid(
        withBehaviour({
          visibility: { kind: 'public', actors: ['Clerk'], roles: ['admin'] },
        }),
      ),
    ).toBe(false);
  });

  it('is either private, or public to the actors it names', () => {
    expect(isValid(withBehaviour({ visibility: { kind: 'private' } }))).toBe(
      true,
    );
    expect(isValid(withBehaviour({ visibility: undefined }))).toBe(false);
    expect(
      isValid(
        withBehaviour({ visibility: { kind: 'private', actors: ['Clerk'] } }),
      ),
    ).toBe(false);
  });

  it('takes and returns building blocks, primitives or collections of them', () => {
    const parsed = SystemModel.parse(
      withBehaviour({
        input: [ORDER, { collectionOf: 'primitive|uuid' }],
        output: ['primitive|boolean'],
      }),
    );

    expect(parsed.behaviours[0]?.input).toHaveLength(2);
    expect(parsed.behaviours[0]?.output).toHaveLength(1);
    expect(isValid(withBehaviour({ input: ['primitive|money'] }))).toBe(false);
  });

  it('lists the building blocks it uses', () => {
    expect(isValid(withBehaviour({ usedBuildingBlocks: [ORDER] }))).toBe(true);
    expect(isValid(withBehaviour({ usedBuildingBlocks: [PLACE] }))).toBe(false);
  });
});

describe('A reference to the type of a value', () => {
  const isRef = (value: unknown) => BuildingBlockRef.safeParse(value).success;

  it('names a building block of the model', () => {
    expect(isRef(ORDER)).toBe(true);
  });

  it('names a primitive', () => {
    expect(isRef('primitive|string')).toBe(true);
  });

  it('describes a collection of any value, collections included', () => {
    expect(isRef({ collectionOf: ORDER })).toBe(true);
    expect(isRef({ collectionOf: { collectionOf: 'primitive|string' } })).toBe(
      true,
    );
    expect(isRef({ collectionOf: 'primitive|money' })).toBe(false);
    expect(isRef({})).toBe(false);
  });

  it('describes a collection only by what it is a collection of', () => {
    expect(isRef({ collectionOf: ORDER, ordered: true })).toBe(false);
  });

  it('never names a module or a behaviour', () => {
    expect(isRef('module|sales.orders')).toBe(false);
    expect(isRef(PLACE)).toBe(false);
  });
});

describe('A primitive', () => {
  it.each([
    'string',
    'integer',
    'decimal',
    'boolean',
    'date',
    'datetime',
    'duration',
    'uuid',
  ])('includes %s', (name) => {
    expect(PrimitiveId.safeParse(`primitive|${name}`).success).toBe(true);
  });

  it.each(['primitive|money', 'string', 'primitive|', 'primitive|String'])(
    'excludes %p',
    (value) => {
      expect(PrimitiveId.safeParse(value).success).toBe(false);
    },
  );

  it('tells an agent the primitives it may name', () => {
    const schema = z.toJSONSchema(PrimitiveId, { io: 'input' });

    expect(schema.pattern).toContain('decimal');
    expect(schema.description).toContain("'primitive|uuid'");
  });
});

describe('A scanned scenario', () => {
  const scenario = (testedElementIds: string[]) => ({
    name: 'Placing an order',
    description: 'The happy path.',
    given: 'a cart with one item',
    when: 'the customer places the order',
    // oxlint-disable-next-line unicorn/no-thenable
    then: 'the order is placed', // NOSONAR
    testedElementIds,
  });
  const isScenario = (value: unknown) =>
    ScannedScenario.safeParse(value).success;

  it('tests building blocks and behaviours', () => {
    expect(isScenario(scenario([ORDER, PLACE]))).toBe(true);
  });

  it('refuses a key it does not know', () => {
    expect(isScenario({ ...scenario([]), tags: ['smoke'] })).toBe(false);
  });

  it('never tests a module', () => {
    expect(isScenario(scenario(['module|sales.orders']))).toBe(false);
  });

  it('tests nothing until the scanner links it', () => {
    const { testedElementIds: _ids, ...unlinked } = scenario([]);

    expect(ScannedScenario.parse(unlinked).testedElementIds).toEqual([]);
  });
});
