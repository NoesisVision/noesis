import { describe, expect, it } from 'bun:test';
import { z } from 'zod';
import {
  Cardinality,
  PrimitiveId,
  PrimitiveName,
  Relation,
  ScannedScenario,
  SourceLocation,
  SystemModel,
  TypeId,
} from '#backend/app/system-model/system-model';

/*
 * The system model is what a scanner found in the code of one unit: its
 * modules, building blocks and behaviors, each flat, and the relations
 * between them in one list beside them. A design document is a diff
 * against it.
 */

const MODULE = 'module|sales.orders';
const ORDER = 'building_block|sales.orders.Order';
const PLACE = 'behavior|sales.orders.Order.place';
const CANCEL = 'behavior|sales.orders.Order.cancel';

const module = {
  id: MODULE,
  name: 'orders',
  source: { path: 'src/sales/orders' },
};
const block = {
  id: ORDER,
  name: 'Order',
  type: 'aggregate',
  source: { path: 'src/sales/orders/order.ts', startLine: 12, endLine: 40 },
};
const behavior = {
  id: PLACE,
  name: 'place',
  type: 'Command',
  visibility: { kind: 'public', actors: ['Customer'] },
  source: { path: 'src/sales/orders/order.ts', startLine: 30 },
};

const model = (patch: Record<string, unknown> = {}) => ({
  id: '01a0d22d-7f47-76b9-abd4-bd21d66a1d17',
  name: 'shop',
  scanned_at: '2026-09-25T08:00:00.000Z',
  modules: [module],
  buildingBlocks: [block],
  behaviors: [behavior],
  ...patch,
});

const withModule = (patch: Record<string, unknown>) =>
  model({ modules: [{ ...module, ...patch }] });
const withBlock = (patch: Record<string, unknown>) =>
  model({ buildingBlocks: [{ ...block, ...patch }] });
const withBehavior = (patch: Record<string, unknown>) =>
  model({ behaviors: [{ ...behavior, ...patch }] });
const withRelation = (relation: Record<string, unknown>) =>
  model({ relations: [relation] });

const isValid = (value: unknown) => SystemModel.safeParse(value).success;
const isRelation = (value: unknown) => Relation.safeParse(value).success;

describe('A system model', () => {
  it('records which unit was scanned and when', () => {
    expect(isValid(model())).toBe(true);
    expect(isValid(model({ id: undefined }))).toBe(false);
    expect(isValid(model({ id: 'shop' }))).toBe(false);
    expect(isValid(model({ name: undefined }))).toBe(false);
    expect(isValid(model({ scanned_at: undefined }))).toBe(false);
  });

  it('holds no element and no relation when the scanner found none', () => {
    const parsed = SystemModel.parse(
      model({
        modules: undefined,
        buildingBlocks: undefined,
        behaviors: undefined,
      }),
    );

    expect(parsed.modules).toEqual([]);
    expect(parsed.buildingBlocks).toEqual([]);
    expect(parsed.behaviors).toEqual([]);
    expect(parsed.relations).toEqual([]);
  });

  it('refuses a key it does not know, so nothing a scanner wrote is lost', () => {
    expect(isValid(model({ scanner: 'ts' }))).toBe(false);
    expect(isValid(withModule({ parent: null }))).toBe(false);
    expect(isValid(withBlock({ invariants: [] }))).toBe(false);
    expect(
      isValid(withBlock({ source: { path: 'order.ts', column: 4 } })),
    ).toBe(false);
    expect(isValid(withBehavior({ usedBuildingBlocks: [] }))).toBe(false);
  });

  it('keeps what an element has in relations, never in the element', () => {
    expect(isValid(withModule({ relations: [] }))).toBe(false);
    expect(
      isValid(
        withBlock({
          properties: [{ name: 'total', type: 'primitive|decimal' }],
        }),
      ),
    ).toBe(false);
    expect(isValid(withBehavior({ input: [] }))).toBe(false);
    expect(isValid(withBehavior({ output: [] }))).toBe(false);
    expect(isValid(withBehavior({ relations: [] }))).toBe(false);
  });

  it('reads back exactly as the scanner wrote it, with every default spelled out', () => {
    const parsed = SystemModel.parse(model());
    const written = z.encode(SystemModel, parsed);

    expect(SystemModel.parse(written)).toEqual(parsed);
    expect(written.modules?.[0]).toEqual({
      ...module,
      description: null,
      source: { path: 'src/sales/orders', startLine: null, endLine: null },
    });
    expect(written.relations).toEqual([]);
    expect(written.commit).toBe(null);
  });
});

describe('A scanned element', () => {
  it('always says where in the code it was found', () => {
    expect(isValid(withModule({ source: undefined }))).toBe(false);
    expect(isValid(withBlock({ source: undefined }))).toBe(false);
    expect(isValid(withBehavior({ source: undefined }))).toBe(false);
  });

  it('has a description only when the code gives one', () => {
    const parsed = SystemModel.parse(model());

    expect(parsed.modules[0]?.description).toBe(null);
    expect(parsed.buildingBlocks[0]?.description).toBe(null);
    expect(parsed.behaviors[0]?.description).toBe(null);
  });

  it('is named by an id of its own kind', () => {
    expect(isValid(withModule({ id: ORDER }))).toBe(false);
    expect(isValid(withBlock({ id: MODULE }))).toBe(false);
    expect(isValid(withBehavior({ id: ORDER }))).toBe(false);
  });
});

describe('Where an element was found', () => {
  const isSource = (value: unknown) => SourceLocation.safeParse(value).success;

  it('names the lines it spans, counting from 1, each when the scanner knows it', () => {
    expect(SourceLocation.parse({ path: 'order.ts' })).toEqual({
      path: 'order.ts',
      startLine: null,
      endLine: null,
    });
    expect(isSource({ path: 'order.ts', startLine: 1, endLine: 9 })).toBe(true);
    expect(isSource({ path: 'order.ts', startLine: 0 })).toBe(false);
    expect(isSource({ path: 'order.ts', endLine: 0 })).toBe(false);
    expect(isSource({ path: 'order.ts', line: 3 })).toBe(false);
  });
});

describe('A scanned building block', () => {
  it('is always classified, by one of the known types', () => {
    expect(isValid(withBlock({ type: undefined }))).toBe(false);
    expect(isValid(withBlock({ type: 'controller' }))).toBe(false);
  });
});

describe('A scanned behavior', () => {
  it('is always classified as a command, an event or a query', () => {
    expect(isValid(withBehavior({ type: 'Query' }))).toBe(true);
    expect(isValid(withBehavior({ type: undefined }))).toBe(false);
    expect(isValid(withBehavior({ type: 'Request' }))).toBe(false);
  });

  it('says nothing about a public behavior beyond the actors it names', () => {
    expect(
      isValid(
        withBehavior({
          visibility: { kind: 'public', actors: ['Clerk'], roles: ['admin'] },
        }),
      ),
    ).toBe(false);
  });

  it('is either private, or public to the actors it names', () => {
    expect(isValid(withBehavior({ visibility: { kind: 'private' } }))).toBe(
      true,
    );
    expect(isValid(withBehavior({ visibility: undefined }))).toBe(false);
    expect(
      isValid(
        withBehavior({ visibility: { kind: 'private', actors: ['Clerk'] } }),
      ),
    ).toBe(false);
  });
});

describe('A relation', () => {
  const slot = { name: 'total', to: 'primitive|decimal', cardinality: '1' };

  it.each([
    { kind: 'module_contains_module', from: MODULE, to: `${MODULE}.returns` },
    { kind: 'module_contains_block', from: MODULE, to: ORDER },
    {
      kind: 'extends',
      from: ORDER,
      to: 'building_block|sales.shared.Auditable',
    },
    { kind: 'has_state', from: ORDER, ...slot },
    { kind: 'exposes', from: ORDER, to: PLACE },
    { kind: 'has_input', from: PLACE, ...slot, position: 1 },
    { kind: 'has_output', from: PLACE, ...slot, name: 'result' },
    { kind: 'behavior_invokes_behavior', from: PLACE, to: CANCEL, order: 1 },
  ])('$kind is one the model knows', (relation) => {
    expect(isRelation(relation)).toBe(true);
    expect(isValid(withRelation(relation))).toBe(true);
  });

  it('has ends of the kinds its kind allows', () => {
    expect(
      isRelation({ kind: 'module_contains_module', from: MODULE, to: ORDER }),
    ).toBe(false);
    expect(
      isRelation({ kind: 'module_contains_block', from: MODULE, to: PLACE }),
    ).toBe(false);
    expect(isRelation({ kind: 'extends', from: ORDER, to: PLACE })).toBe(false);
    expect(isRelation({ kind: 'exposes', from: PLACE, to: PLACE })).toBe(false);
    expect(isRelation({ kind: 'has_state', from: PLACE, ...slot })).toBe(false);
    expect(
      isRelation({
        kind: 'behavior_invokes_behavior',
        from: PLACE,
        to: ORDER,
        order: 1,
      }),
    ).toBe(false);
  });

  it('carries the data its edge shows, and nothing more', () => {
    expect(
      isRelation({
        kind: 'behavior_invokes_behavior',
        from: PLACE,
        to: CANCEL,
      }),
    ).toBe(false);
    expect(isRelation({ kind: 'has_input', from: PLACE, ...slot })).toBe(false);
    expect(
      isRelation({ kind: 'has_input', from: PLACE, ...slot, position: 0 }),
    ).toBe(false);
    expect(
      isRelation({ kind: 'has_state', from: ORDER, ...slot, description: 'x' }),
    ).toBe(false);
    expect(
      isRelation({ kind: 'exposes', from: ORDER, to: PLACE, order: 1 }),
    ).toBe(false);
    expect(isRelation({ kind: 'implements', from: ORDER, to: ORDER })).toBe(
      false,
    );
  });
});

describe('A named slot', () => {
  const state = (patch: Record<string, unknown>) => ({
    kind: 'has_state',
    from: ORDER,
    name: 'total',
    to: 'primitive|decimal',
    cardinality: '1',
    ...patch,
  });

  it('always has a name, a type and a cardinality', () => {
    expect(isRelation(state({}))).toBe(true);
    expect(isRelation(state({ name: undefined }))).toBe(false);
    expect(isRelation(state({ to: undefined }))).toBe(false);
    expect(isRelation(state({ cardinality: undefined }))).toBe(false);
  });

  it('says a collection by its cardinality, never by its type', () => {
    expect(isRelation(state({ cardinality: '*' }))).toBe(true);
    expect(
      isRelation(state({ to: { collectionOf: 'primitive|decimal' } })),
    ).toBe(false);
  });

  it("is named 'result' when it is what a behavior gives back", () => {
    const output = {
      kind: 'has_output',
      from: PLACE,
      to: ORDER,
      cardinality: '0..1',
    };
    expect(isRelation({ ...output, name: 'result' })).toBe(true);
    expect(isRelation({ ...output, name: 'order' })).toBe(false);
    expect(isRelation(output)).toBe(false);
  });
});

describe('A cardinality', () => {
  it.each(Cardinality.options)('includes %p', (value) => {
    expect(Cardinality.safeParse(value).success).toBe(true);
  });

  it.each(['0..*', '1..*', 'many', 2])('excludes %p', (value) => {
    expect(Cardinality.safeParse(value).success).toBe(false);
  });
});

describe('The type of a slot', () => {
  const isType = (value: unknown) => TypeId.safeParse(value).success;

  it('names a building block of the model or a primitive', () => {
    expect(isType(ORDER)).toBe(true);
    expect(isType('primitive|string')).toBe(true);
  });

  it('never names a module, a behavior or a wrapper', () => {
    expect(isType(MODULE)).toBe(false);
    expect(isType(PLACE)).toBe(false);
    expect(isType({ collectionOf: ORDER })).toBe(false);
  });
});

describe('A primitive', () => {
  it.each(PrimitiveName.options)('includes %s', (name) => {
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

const RULE = 'rule|sales.orders.Paid orders only';
const SCENARIO = 'scenario|sales.orders.Paid orders only.Placing an order';
const rule = {
  id: RULE,
  name: 'Paid orders only',
  kind: 'state_change',
  source: { path: 'features/orders.feature', startLine: 4, endLine: null },
};
const scenario = {
  id: SCENARIO,
  name: 'Placing an order',
  description: 'The happy path.',
  steps: [
    { kind: 'given', text: 'a cart with one item' },
    { kind: 'when', text: 'the customer places the order' },
    { kind: 'then', text: 'the order is placed' },
  ],
  source: { path: 'features/orders.feature', startLine: 7, endLine: null },
};

describe('A scanned rule', () => {
  it('is an element of its own, which a behavior governs and a scenario illustrates', () => {
    const parsed = SystemModel.parse(
      model({
        rules: [rule],
        scenarios: [scenario],
        relations: [
          { kind: 'governs', from: PLACE, to: RULE },
          { kind: 'illustrates', from: SCENARIO, to: RULE },
        ],
      }),
    );

    expect<unknown>(parsed.rules.map((r) => r.id)).toEqual([RULE]);
    expect(parsed.relations.map((r) => r.kind)).toEqual([
      'governs',
      'illustrates',
    ]);
  });

  it('is none until the scanner finds one', () => {
    const parsed = SystemModel.parse(model());

    expect(parsed.rules).toEqual([]);
    expect(parsed.scenarios).toEqual([]);
  });

  it('is classified by its kind alone', () => {
    for (const kind of [
      'validation',
      'state_change',
      'post',
      'computation',
      'coordination',
      'configuration',
    ]) {
      expect(isValid(model({ rules: [{ ...rule, kind }] }))).toBe(true);
    }
    expect(isValid(model({ rules: [{ ...rule, kind: undefined }] }))).toBe(
      false,
    );
    expect(isValid(model({ rules: [{ ...rule, kind: 'Business' }] }))).toBe(
      false,
    );
    expect(isValid(model({ rules: [{ ...rule, category: 'Business' }] }))).toBe(
      false,
    );
  });

  it('is on no module, building block or behavior', () => {
    expect(isValid(withBlock({ rules: [] }))).toBe(false);
    expect(isValid(withBehavior({ rules: [] }))).toBe(false);
    expect(isValid(model({ modules: [{ ...module, rules: [] }] }))).toBe(false);
  });

  it('has a description only when the feature file gives one', () => {
    expect(
      SystemModel.parse(model({ rules: [rule] })).rules[0]?.description,
    ).toBe(null);
  });

  it('is governed only by a behavior and illustrated only by a scenario', () => {
    expect(
      isValid(withRelation({ kind: 'governs', from: ORDER, to: RULE })),
    ).toBe(false);
    expect(
      isValid(withRelation({ kind: 'governs', from: PLACE, to: SCENARIO })),
    ).toBe(false);
    expect(
      isValid(withRelation({ kind: 'illustrates', from: PLACE, to: RULE })),
    ).toBe(false);
  });
});

describe('A scanned scenario', () => {
  it('refuses a key it does not know', () => {
    expect(ScannedScenario.safeParse(scenario).success).toBe(true);
    expect(
      ScannedScenario.safeParse({ ...scenario, testedElementIds: [ORDER] })
        .success,
    ).toBe(false);
  });

  it('always has its steps and where the feature file states it', () => {
    expect(ScannedScenario.safeParse({ ...scenario, steps: [] }).success).toBe(
      false,
    );
    expect(
      ScannedScenario.safeParse({ ...scenario, source: undefined }).success,
    ).toBe(false);
  });

  it('is named under its rule', () => {
    expect(
      ScannedScenario.safeParse({ ...scenario, id: 'scenario|sales.Placing' })
        .success,
    ).toBe(false);
  });
});
