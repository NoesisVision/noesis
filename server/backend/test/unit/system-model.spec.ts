import { describe, expect, it } from 'bun:test';
import { z } from 'zod';
import {
  BuildingBlockType,
  isCollaboratorType,
  PrimitiveId,
  Relation,
  type RelationKey,
  ScannedScenario,
  SystemModel,
  TypeId,
} from '#backend/app/system-model/system-model';

/*
 * The system model is what a scanner found in the code of one unit: its
 * modules, building blocks and behaviors, and the relations between them.
 * A design document is a diff against it.
 */

const ORDERS = 'module|sales.orders';
const ORDER = 'building_block|sales.orders.Order';
const PLACE = 'behavior|sales.orders.Order.place';
const CANCEL = 'behavior|sales.orders.Order.cancel';
const CUSTOMER = 'actor|Customer';
const RETURN_GOODS = 'manual_process|Return goods';

const module = {
  id: ORDERS,
  name: 'orders',
  source: { path: 'src/sales/orders' },
};
const block = {
  id: ORDER,
  name: 'Order',
  type: 'aggregate',
  source: { path: 'src/sales/orders/order.ts', line: 12 },
};
const behavior = {
  id: PLACE,
  name: 'place',
  source: { path: 'src/sales/orders/order.ts', line: 30 },
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

const withBlock = (patch: Record<string, unknown>) =>
  model({ buildingBlocks: [{ ...block, ...patch }] });
const withBehavior = (patch: Record<string, unknown>) =>
  model({ behaviors: [{ ...behavior, ...patch }] });
const withRelations = (relations: unknown[]) => model({ relations });

const isValid = (value: unknown) => SystemModel.safeParse(value).success;

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
    expect(parsed.rules).toEqual([]);
    expect(parsed.scenarios).toEqual([]);
    expect(parsed.actors).toEqual([]);
    expect<unknown>(parsed.manualProcesses).toEqual([]);
    expect<unknown>(parsed.deployableUnits).toEqual([]);
    expect<unknown>(parsed.libraries).toEqual([]);
    expect<unknown>(parsed.layers).toEqual([]);
    expect<unknown>(parsed.deploymentContainers).toEqual([]);
    expect(parsed.relations).toEqual([]);
  });

  it('refuses a key it does not know, so nothing a scanner wrote is lost', () => {
    expect(isValid(model({ scanner: 'ts' }))).toBe(false);
    expect(isValid(model({ modules: [{ ...module, parent: null }] }))).toBe(
      false,
    );
    expect(isValid(withBlock({ invariants: [] }))).toBe(false);
    expect(
      isValid(withBlock({ source: { path: 'order.ts', column: 4 } })),
    ).toBe(false);
    expect(
      isValid(
        withBlock({
          properties: [{ name: 'total', type: 'primitive|decimal' }],
        }),
      ),
    ).toBe(false);
    expect(isValid(withBehavior({ usedBuildingBlocks: [] }))).toBe(false);
    expect(isValid(withBehavior({ invokes: [] }))).toBe(false);
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
    expect(isValid(withBehavior({ source: undefined }))).toBe(false);
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
    expect(parsed.behaviors[0]?.description).toBe(null);
  });

  it('is named by an id of its own kind', () => {
    expect(isValid(model({ modules: [{ ...module, id: ORDER }] }))).toBe(false);
    expect(isValid(withBlock({ id: 'module|sales.orders' }))).toBe(false);
    expect(isValid(withBehavior({ id: ORDER }))).toBe(false);
  });

  it('carries only what is its own: what it holds, extends, takes or calls is a relation', () => {
    expect(isValid(withBlock({ implements: [] }))).toBe(false);
    expect(isValid(withBehavior({ buildingBlockId: ORDER }))).toBe(false);
    expect(isValid(withBehavior({ input: [] }))).toBe(false);
    expect(isValid(withBehavior({ output: [] }))).toBe(false);
  });
});

describe('A scanned building block', () => {
  it('is always classified, by one of the known types', () => {
    expect(isValid(withBlock({ type: undefined }))).toBe(false);
    expect(isValid(withBlock({ type: 'controller' }))).toBe(false);
  });

  it('may be a message, an adapter on either side, or a technical service', () => {
    for (const type of [
      'event',
      'command',
      'query',
      'in_adapter',
      'out_adapter',
      'technical_service',
    ])
      expect(isValid(withBlock({ type }))).toBe(true);
  });
});

describe('A building block kind', () => {
  it('is held as state when it is a value of the domain, as a collaborator otherwise', () => {
    const state = [
      'aggregate',
      'entity',
      'value_object',
      'event',
      'command',
      'query',
    ];
    const collaborators = BuildingBlockType.options.filter(
      (type) => !state.includes(type),
    );

    for (const type of state)
      expect(isCollaboratorType(type as BuildingBlockType)).toBe(false);
    expect(collaborators).toEqual([
      'domain_service',
      'application_service',
      'repository',
      'factory',
      'external_integration',
      'in_adapter',
      'out_adapter',
      'technical_service',
    ]);
    for (const type of collaborators)
      expect(isCollaboratorType(type)).toBe(true);
  });
});

describe('A scanned behavior', () => {
  it('has no type: what kind of message it handles is not its own', () => {
    expect(isValid(withBehavior({ type: 'Command' }))).toBe(false);
  });

  it('says nothing of who may call it: actors drive the system through manual processes', () => {
    expect(
      isValid(withBehavior({ visibility: { kind: 'public', actors: [] } })),
    ).toBe(false);
  });
});

describe('An actor and a manual process', () => {
  const actor = {
    id: CUSTOMER,
    name: 'Customer',
    source: { path: 'src/sales/orders/order.ts', line: 29 },
  };
  const process = { id: RETURN_GOODS, name: 'Return goods' };

  it('are elements of their own, named by their name alone', () => {
    const parsed = SystemModel.parse(
      model({ actors: [actor], manualProcesses: [process] }),
    );
    expect<unknown>(parsed.actors).toEqual([{ ...actor, description: null }]);
    expect<unknown>(parsed.manualProcesses).toEqual([
      { ...process, description: null, source: null },
    ]);
    expect(
      isValid(model({ actors: [{ ...actor, id: 'actor|sales.Customer' }] })),
    ).toBe(false);
  });

  it('say where in the code an actor was named; a manual process is never in it', () => {
    expect(isValid(model({ actors: [{ ...actor, source: undefined }] }))).toBe(
      false,
    );
  });
});

describe('A deployable unit and a library', () => {
  const unit = {
    id: 'deployable_unit|shop-api',
    name: 'shop-api',
    source: { path: 'shop-api' },
  };
  const library = {
    id: 'library|MyCompany.Sales',
    name: 'MyCompany.Sales',
  };

  it('are elements of their own, named as the build names them, dots and all', () => {
    const parsed = SystemModel.parse(
      model({ deployableUnits: [unit], libraries: [library] }),
    );
    expect<unknown>(parsed.deployableUnits).toEqual([
      { ...unit, description: null, source: { path: 'shop-api', line: null } },
    ]);
    expect<unknown>(parsed.libraries).toEqual([
      { ...library, description: null, source: null },
    ]);
    expect(
      isValid(model({ libraries: [{ ...library, id: 'library|a|b' }] })),
    ).toBe(false);
  });

  it('contain modules, for a unit, and building blocks, for a library', () => {
    expect(
      isValid(
        model({
          deployableUnits: [unit],
          libraries: [library],
          relations: [
            { kind: 'contains', from: unit.id, to: ORDERS },
            { kind: 'contains', from: library.id, to: ORDER },
          ],
        }),
      ),
    ).toBe(true);
    expect(
      isValid(
        model({ relations: [{ kind: 'contains', from: unit.id, to: PLACE }] }),
      ),
    ).toBe(false);
  });
});

describe('A layer and a deployment container', () => {
  const layer = { id: 'layer|domain', name: 'domain' };
  const container = {
    id: 'deployment_container|Orders cluster',
    name: 'Orders cluster',
  };
  const unit = { id: 'deployable_unit|shop-api', name: 'shop-api' };

  it('are elements of their own, named by one name', () => {
    const parsed = SystemModel.parse(
      model({ layers: [layer], deploymentContainers: [container] }),
    );
    expect<unknown>(parsed.layers).toEqual([
      { ...layer, description: null, source: null },
    ]);
    expect<unknown>(parsed.deploymentContainers).toEqual([
      { ...container, description: null, source: null },
    ]);
    expect(
      isValid(model({ layers: [{ ...layer, id: 'layer|shop.domain' }] })),
    ).toBe(false);
  });

  it('let a layer contain building blocks and a container host deployable units', () => {
    expect(
      isValid(
        model({
          layers: [layer],
          deploymentContainers: [container],
          deployableUnits: [unit],
          relations: [
            { kind: 'contains', from: layer.id, to: ORDER },
            { kind: 'hosts', from: container.id, to: unit.id },
          ],
        }),
      ),
    ).toBe(true);
    expect(
      isValid(
        model({
          relations: [{ kind: 'hosts', from: container.id, to: ORDERS }],
        }),
      ),
    ).toBe(false);
    expect(
      isValid(
        model({ relations: [{ kind: 'hosts', from: layer.id, to: unit.id }] }),
      ),
    ).toBe(false);
  });
});

describe('A relation', () => {
  const contains = { kind: 'contains', from: ORDERS, to: ORDER };
  const state = {
    kind: 'has_state',
    from: ORDER,
    to: 'primitive|decimal',
    name: 'total',
    cardinality: '1',
  };
  const input = {
    kind: 'has_input',
    from: PLACE,
    to: 'primitive|uuid',
    name: 'customerId',
    cardinality: '1',
    position: 1,
  };
  const output = {
    kind: 'has_output',
    from: PLACE,
    to: ORDER,
    cardinality: '1',
  };
  const invokes = { kind: 'invokes', from: CANCEL, to: PLACE, order: 1 };
  const collaborator = {
    kind: 'has_collaborator',
    from: ORDER,
    to: 'building_block|sales.orders.Orders',
    name: 'orders',
  };

  it('is one of the known kinds, between elements of the kinds it allows', () => {
    expect(
      isValid(
        withRelations([
          contains,
          { kind: 'contains', from: 'module|sales', to: ORDERS },
          { kind: 'extends', from: ORDER, to: 'building_block|sales.Base' },
          state,
          collaborator,
          { kind: 'exposes', from: ORDER, to: PLACE },
          input,
          output,
          invokes,
          { kind: 'invokes', from: RETURN_GOODS, to: PLACE, order: 1 },
          { kind: 'performs', from: CUSTOMER, to: RETURN_GOODS },
        ]),
      ),
    ).toBe(true);
    expect(isValid(withRelations([{ ...invokes, from: CUSTOMER }]))).toBe(
      false,
    );
    expect(
      isValid(withRelations([{ kind: 'performs', from: CUSTOMER, to: PLACE }])),
    ).toBe(false);
    expect(
      isValid(
        withRelations([{ kind: 'performs', from: PLACE, to: RETURN_GOODS }]),
      ),
    ).toBe(false);
    expect(isValid(withRelations([{ ...contains, kind: 'holds' }]))).toBe(
      false,
    );
    expect(isValid(withRelations([{ ...contains, from: ORDER }]))).toBe(false);
    expect(isValid(withRelations([{ ...contains, to: PLACE }]))).toBe(false);
    expect(
      isValid(withRelations([{ kind: 'extends', from: ORDER, to: ORDERS }])),
    ).toBe(false);
    expect(
      isValid(withRelations([{ kind: 'exposes', from: ORDERS, to: PLACE }])),
    ).toBe(false);
    expect(isValid(withRelations([{ ...invokes, to: ORDER }]))).toBe(false);
    expect(
      isValid(withRelations([{ ...collaborator, to: 'primitive|string' }])),
    ).toBe(false);
    expect(isValid(withRelations([{ ...collaborator, from: PLACE }]))).toBe(
      false,
    );
  });

  it('carries only what the diagram puts on the edge: a name, a cardinality, an order', () => {
    expect(isValid(withRelations([{ ...state, description: 'x' }]))).toBe(
      false,
    );
    expect(isValid(withRelations([{ ...contains, name: 'x' }]))).toBe(false);
    expect(isValid(withRelations([{ ...output, name: 'result' }]))).toBe(false);
    expect(isValid(withRelations([{ ...invokes, cardinality: '1' }]))).toBe(
      false,
    );
    expect(
      isValid(withRelations([{ ...collaborator, cardinality: '1' }])),
    ).toBe(false);
  });

  it('types a slot by a building block or a primitive, never by a wrapper', () => {
    const isTypeId = (value: unknown) => TypeId.safeParse(value).success;

    expect(isTypeId(ORDER)).toBe(true);
    expect(isTypeId('primitive|string')).toBe(true);
    expect(isTypeId({ collectionOf: ORDER })).toBe(false);
    expect(isTypeId('primitive|money')).toBe(false);
    expect(isTypeId(ORDERS)).toBe(false);
    expect(isTypeId(PLACE)).toBe(false);
    expect(isValid(withRelations([{ ...state, to: PLACE }]))).toBe(false);
    expect(isValid(withRelations([{ ...input, to: ORDERS }]))).toBe(false);
  });

  it('says how many values a slot holds, by one of four cardinalities', () => {
    for (const cardinality of ['0..1', '1', '0..*', '1..*']) {
      expect(isValid(withRelations([{ ...state, cardinality }]))).toBe(true);
      expect(isValid(withRelations([{ ...input, cardinality }]))).toBe(true);
      expect(isValid(withRelations([{ ...output, cardinality }]))).toBe(true);
    }
    expect(isValid(withRelations([{ ...state, cardinality: '*' }]))).toBe(
      false,
    );
    expect(isValid(withRelations([{ ...state, cardinality: undefined }]))).toBe(
      false,
    );
    expect(isValid(withRelations([{ ...state, optional: true }]))).toBe(false);
  });

  it('names a piece of state, a collaborator and an input, never an output', () => {
    expect(isValid(withRelations([{ ...state, name: undefined }]))).toBe(false);
    expect(isValid(withRelations([{ ...collaborator, name: undefined }]))).toBe(
      false,
    );
    expect(isValid(withRelations([{ ...input, name: undefined }]))).toBe(false);
    expect(isValid(withRelations([{ ...state, name: 'a.b' }]))).toBe(false);
  });

  it('orders a call from 1', () => {
    expect(isValid(withRelations([{ ...invokes, order: 0 }]))).toBe(false);
    expect(isValid(withRelations([{ ...invokes, order: 1.5 }]))).toBe(false);
    expect(isValid(withRelations([{ ...invokes, order: undefined }]))).toBe(
      false,
    );
  });

  it('is unique by its kind and ends, or, for a named slot, by its holder and name', () => {
    expect(Relation.keyOf(contains)).toBe(Relation.keyOf({ ...contains }));
    expect(Relation.keyOf(state)).toBe(
      Relation.keyOf({ ...state, to: 'primitive|integer' }),
    );
    expect(Relation.keyOf(collaborator)).toBe(
      Relation.keyOf({ ...collaborator, to: 'building_block|sales.Archive' }),
    );
    expect(Relation.keyOf(state)).not.toBe(
      Relation.keyOf({ ...state, name: 'count' }),
    );
    expect(Relation.keyOf(input)).toBe(
      Relation.keyOf({
        ...input,
        cardinality: '0..1',
      } as object as RelationKey),
    );
    expect(Relation.keyOf(output)).not.toBe(
      Relation.keyOf({ ...output, to: 'primitive|boolean' }),
    );
    expect(Relation.keyOf(invokes)).toBe(
      Relation.keyOf({ ...invokes, order: 3 } as object as RelationKey),
    );
    expect(Relation.keyOf({ ...state, kind: 'has_input' })).not.toBe(
      Relation.keyOf(state),
    );
  });

  it('sorts by kind, holder, target, then name or order, so two builds give one file', () => {
    const parsed = SystemModel.parse(
      withRelations([
        { ...invokes, to: 'behavior|sales.orders.Order.ship', order: 2 },
        invokes,
        { ...state, name: 'count', to: 'primitive|integer' },
        { ...state, name: 'weight', to: 'primitive|decimal' },
        state,
        contains,
      ]),
    );

    expect(
      [...parsed.relations]
        .sort(Relation.compare)
        .map((r) => [r.kind, r.to, 'name' in r ? r.name : '']),
    ).toEqual([
      ['contains', ORDER, ''],
      ['has_state', 'primitive|decimal', 'total'],
      ['has_state', 'primitive|decimal', 'weight'],
      ['has_state', 'primitive|integer', 'count'],
      ['invokes', PLACE, ''],
      ['invokes', 'behavior|sales.orders.Order.ship', ''],
    ]);
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

const RULE = 'rule|sales.orders.Paid orders only';
const SCENARIO = 'scenario|sales.orders.Paid orders only.Placing an order';
const rule = {
  id: RULE,
  name: 'Paid orders only',
  kind: 'state_change',
  source: { path: 'features/orders.feature', line: 4 },
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
  source: { path: 'features/orders.feature', line: 7 },
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
      isValid(withRelations([{ kind: 'governs', from: ORDER, to: RULE }])),
    ).toBe(false);
    expect(
      isValid(withRelations([{ kind: 'governs', from: PLACE, to: SCENARIO }])),
    ).toBe(false);
    expect(
      isValid(withRelations([{ kind: 'illustrates', from: PLACE, to: RULE }])),
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
