import { describe, expect, it } from 'bun:test';
import { z } from 'zod';
import { DesignDocument } from '#backend/app/design-docs/design-doc';
import { SystemModel } from '#backend/app/system-model/system-model';
import {
  designDocFixture,
  greenFieldDesignDocFixture,
} from '../fixtures/design-doc.fixture';

/*
 * A design document is a diff against the scanned model: the modules,
 * building blocks and behaviors a change adds, modifies or removes. An agent
 * writes it; a human reviews it.
 */

const REFUND = 'building_block|sales.refunds.Refund';
const ISSUE = 'behavior|sales.refunds.Refund.issue';

const design = (patch: Record<string, unknown> = {}) => ({
  id: '2026-01-01-partial-refunds',
  name: 'Partial refunds',
  description: 'Let a clerk refund single order lines.',
  ...patch,
});

const SALES = 'module|sales';
const REFUNDS = 'module|sales.refunds';

/** The modules the refund lives in. */
const refundModules = {
  added: [
    {
      id: SALES,
      name: { value: 'sales' },
      definition: { value: 'Selling to customers.' },
    },
    {
      id: REFUNDS,
      name: { value: 'refunds' },
      definition: { value: 'Money back.' },
    },
  ],
};

/** Each module containing the next, down to the refund. */
const refundContainment = [
  { kind: 'module_contains_module', from: SALES, to: REFUNDS },
  { kind: 'module_contains_block', from: REFUNDS, to: REFUND },
];

/** A design that adds one building block, with the given fields, and the given relations beside its containment. */
const addingRefund = (block: object, relations: object = {}) =>
  design({
    modules: refundModules,
    buildingBlocks: {
      added: [{ id: REFUND, name: { value: 'Refund' }, ...block }],
    },
    relations: withContainment(refundContainment, relations),
  });

/** A design that adds one behavior, with the given fields, on a refund it adds too. */
const addingIssue = (behavior: object, relations: object = {}) =>
  design({
    modules: refundModules,
    buildingBlocks: {
      added: [
        {
          id: REFUND,
          name: { value: 'Refund' },
          type: { value: 'aggregate' },
          definition: { value: 'Money back for an order.' },
        },
      ],
    },
    behaviors: {
      added: [{ id: ISSUE, name: { value: 'issue' }, ...behavior }],
    },
    relations: withContainment(
      [...refundContainment, { kind: 'exposes', from: REFUND, to: ISSUE }],
      relations,
    ),
  });

function withContainment(
  containment: object[],
  { added = [], ...rest }: { added?: object[] },
) {
  return { added: [...containment, ...added], ...rest };
}

const isValid = (document: unknown) =>
  DesignDocument.safeParse(document).success;

describe('A design document', () => {
  it('is identified by its creation date and name', () => {
    expect(isValid(design({ id: '2026-01-01-partial-refunds' }))).toBe(true);
    expect(isValid(design({ id: 'partial-refunds' }))).toBe(false);
  });

  it('always has a name and a description', () => {
    expect(isValid(design({ name: undefined }))).toBe(false);
    expect(isValid(design({ description: undefined }))).toBe(false);
  });

  it('is not implemented until marked so', () => {
    expect(DesignDocument.parse(design()).implemented).toBe(false);
    expect(
      DesignDocument.parse(design({ implemented: true })).implemented,
    ).toBe(true);
  });

  it('changes nothing in a part it leaves out', () => {
    const parsed = DesignDocument.parse(addingRefund({}));

    expect(parsed.behaviors).toEqual({ added: [], removed: [], modified: [] });
    expect(parsed.rules).toEqual({ added: [], removed: [], modified: [] });
    expect(parsed.scenarios).toEqual({ added: [], removed: [], modified: [] });
    expect(DesignDocument.parse(design()).relations).toEqual({
      added: [],
      removed: [],
      modified: [],
    });
  });

  it('refuses a key it does not know, so nothing written is lost', () => {
    expect(isValid(design({ implemented: false, status: 'draft' }))).toBe(
      false,
    );
    expect(
      isValid(addingRefund({ descripton: { value: 'Money back.' } })),
    ).toBe(false);
    expect(
      isValid(
        addingRefund(
          {},
          {
            added: [
              {
                kind: 'has_state',
                from: REFUND,
                name: 'total',
                to: { value: 'primitive|decimal' },
                cardinality: { value: '1' },
                optional: { value: true },
              },
            ],
          },
        ),
      ),
    ).toBe(false);
    expect(isValid(addingRefund({ properties: { added: [] } }))).toBe(false);
  });

  it('reads back exactly as it was written, with the time it was marked implemented only the server writes', () => {
    const parsed = DesignDocument.parse(designDocFixture);

    expect(z.encode(DesignDocument, parsed)).toEqual({
      ...designDocFixture,
      implementedAt: null,
    });
  });
});

describe('The elements a design changes', () => {
  it('adds and modifies an element whole, and removes one by its id', () => {
    const parsed = DesignDocument.parse(
      design({
        modules: {
          added: [{ id: 'module|sales.refunds', name: { value: 'refunds' } }],
          removed: ['module|sales.credit-notes'],
          modified: [{ id: 'module|sales.orders' }],
        },
      }),
    );

    expect<string[]>(parsed.modules.added.map((m) => m.id)).toEqual([
      'module|sales.refunds',
    ]);
    expect<string[]>(parsed.modules.removed).toEqual([
      'module|sales.credit-notes',
    ]);
    expect<string[]>(parsed.modules.modified.map((m) => m.id)).toEqual([
      'module|sales.orders',
    ]);
  });

  it('names a module, a building block and a behavior each by an id of its own kind', () => {
    expect(isValid(design({ modules: { added: [{ id: REFUND }] } }))).toBe(
      false,
    );
    expect(
      isValid(
        design({ buildingBlocks: { removed: ['module|sales.refunds'] } }),
      ),
    ).toBe(false);
    expect(isValid(design({ behaviors: { removed: [REFUND] } }))).toBe(false);
  });

  it('removes a rule or a scenario by its id', () => {
    const RULE = 'rule|sales.refunds.Refund only paid orders';
    const parsed = DesignDocument.parse(
      design({
        rules: { removed: [RULE] },
        scenarios: {
          removed: [
            `scenario|sales.refunds.Refund only paid orders.Whole order`,
          ],
        },
      }),
    );

    expect<string[]>(parsed.rules.removed).toEqual([RULE]);
    expect<string[]>(parsed.scenarios.removed).toEqual([
      'scenario|sales.refunds.Refund only paid orders.Whole order',
    ]);
    expect(
      isValid(design({ rules: { removed: ['Refund only paid orders'] } })),
    ).toBe(false);
    expect(isValid(design({ scenarios: { removed: [RULE] } }))).toBe(false);
  });

  it('holds rules and scenarios as elements of their own, on no module, block or behavior', () => {
    expect(isValid(addingRefund({ rules: { removed: [] } }))).toBe(false);
    expect(isValid(addingIssue({ scenarios: { removed: [] } }))).toBe(false);
    expect(
      isValid(
        design({
          modules: { added: [{ id: 'module|sales.refunds', rules: {} }] },
        }),
      ),
    ).toBe(false);
  });

  it('classifies a rule by its kind alone', () => {
    const adding = (rule: object) =>
      design({
        rules: {
          added: [{ id: 'rule|sales.refunds.Paid only', ...rule }],
        },
      });
    expect(isValid(adding({ kind: { value: 'validation' } }))).toBe(true);
    expect(isValid(adding({ kind: { value: 'Validation' } }))).toBe(false);
    expect(isValid(adding({ category: { value: 'Business' } }))).toBe(false);
    expect(isValid(adding({ ruleType: { value: 'State change' } }))).toBe(
      false,
    );
  });

  it('adds and removes a relation beside the elements, by its kind and both ends', () => {
    const extending = (to: string) => ({ kind: 'extends', from: REFUND, to });
    const parsed = DesignDocument.parse(
      design({
        relations: {
          added: [extending('building_block|sales.shared.Auditable')],
          removed: [extending('building_block|sales.shared.Legacy')],
        },
      }),
    );

    expect<unknown>(parsed.relations).toEqual({
      added: [extending('building_block|sales.shared.Auditable')],
      removed: [extending('building_block|sales.shared.Legacy')],
      modified: [],
    });
    expect(
      isValid(
        design({ relations: { removed: [{ kind: 'extends', from: REFUND }] } }),
      ),
    ).toBe(false);
  });

  it('changes a named slot in place: what it points at and how many', () => {
    const parsed = DesignDocument.parse(
      design({
        relations: {
          modified: [
            {
              kind: 'has_input',
              from: ISSUE,
              name: 'reason',
              cardinality: { value: '0..1' },
            },
            {
              kind: 'has_output',
              from: ISSUE,
              name: 'result',
              to: { value: REFUND },
            },
            {
              kind: 'behavior_invokes_behavior',
              from: ISSUE,
              to: 'behavior|sales.orders.Order.cancel',
              order: { value: 2 },
            },
          ],
        },
      }),
    );
    const [input, output, invokes] = parsed.relations.modified;

    expect<unknown>(input).toEqual({
      kind: 'has_input',
      from: ISSUE,
      name: 'reason',
      to: { changed: false },
      cardinality: { changed: true, value: '0..1', author: 'agent' },
      position: { changed: false },
    });
    expect<unknown>(output).toMatchObject({
      to: { changed: true, value: REFUND },
      cardinality: { changed: false },
    });
    expect<unknown>(invokes).toMatchObject({ order: { value: 2 } });
  });

  it('removes a named slot by its kind, holder, type and name', () => {
    const parsed = DesignDocument.parse(
      design({
        relations: {
          removed: [
            {
              kind: 'has_input',
              from: ISSUE,
              to: 'primitive|string',
              name: 'note',
            },
            {
              kind: 'has_output',
              from: ISSUE,
              to: 'primitive|boolean',
              name: 'result',
            },
          ],
        },
      }),
    );

    expect(parsed.relations.removed.map((key) => key.kind)).toEqual([
      'has_input',
      'has_output',
    ]);
    expect(
      isValid(
        design({
          relations: {
            removed: [{ kind: 'has_input', from: ISSUE, name: 'note' }],
          },
        }),
      ),
    ).toBe(false);
  });

  it("names every input, and every output 'result'", () => {
    const slot = { to: { value: REFUND }, cardinality: { value: '1' } };
    expect(
      isValid(
        addingIssue(
          {},
          {
            added: [
              {
                kind: 'has_input',
                from: ISSUE,
                ...slot,
                position: { value: 1 },
              },
            ],
          },
        ),
      ),
    ).toBe(false);
    expect(
      isValid(
        addingIssue(
          {},
          {
            added: [
              { kind: 'has_output', from: ISSUE, name: 'refund', ...slot },
            ],
          },
        ),
      ),
    ).toBe(false);
    expect(
      isValid(
        addingIssue(
          {},
          {
            added: [
              { kind: 'has_output', from: ISSUE, name: 'result', ...slot },
            ],
          },
        ),
      ),
    ).toBe(true);
  });

  it('classifies a building block and a behavior only by the known types', () => {
    expect(isValid(addingRefund({ type: { value: 'aggregate' } }))).toBe(true);
    expect(isValid(addingRefund({ type: { value: 'controller' } }))).toBe(
      false,
    );
    expect(isValid(addingIssue({ type: { value: 'Command' } }))).toBe(true);
    expect(isValid(addingIssue({ type: { value: 'Request' } }))).toBe(false);
  });
});

describe('A field of a design', () => {
  it('is unchanged when the design leaves it out', () => {
    const block = DesignDocument.parse(addingRefund({})).buildingBlocks
      .added[0]!;

    expect(block.definition).toEqual({ changed: false });
  });

  it('is a change when it has a value, written by the agent unless a human wrote it', () => {
    const block = DesignDocument.parse(
      addingRefund({
        definition: { value: 'Money back.' },
        type: { value: 'aggregate', author: 'human' },
      }),
    ).buildingBlocks.added[0]!;

    expect(block.definition).toEqual({
      changed: true,
      value: 'Money back.',
      author: 'agent',
    });
    expect(block.type).toEqual({
      changed: true,
      value: 'aggregate',
      author: 'human',
    });
  });

  it('carries neither a value nor an author when unchanged', () => {
    expect(
      isValid(addingRefund({ definition: { changed: false, value: 'x' } })),
    ).toBe(false);
    expect(
      isValid(
        addingRefund({ definition: { changed: false, author: 'human' } }),
      ),
    ).toBe(false);
  });

  it('is written either by an agent or by a human', () => {
    expect(
      isValid(addingRefund({ definition: { value: 'x', author: 'bot' } })),
    ).toBe(false);
  });
});

describe('The type of a named slot', () => {
  const withType = (to: unknown, cardinality = '1') =>
    addingRefund(
      {},
      {
        added: [
          {
            kind: 'has_state',
            from: REFUND,
            name: 'amount',
            to: { value: to },
            cardinality: { value: cardinality },
          },
        ],
      },
    );

  it('is a building block of the model or a primitive, a collection said by its cardinality', () => {
    expect(isValid(withType('building_block|sales.shared.Money'))).toBe(true);
    expect(isValid(withType('primitive|decimal'))).toBe(true);
    expect(isValid(withType('primitive|string', '*'))).toBe(true);
    expect(isValid(withType({ collectionOf: 'primitive|string' }))).toBe(false);
    expect(isValid(withType('primitive|string', '0..*'))).toBe(false);
  });

  it('knows only its own primitives, each named as a primitive', () => {
    expect(isValid(withType('primitive|money'))).toBe(false);
    expect(isValid(withType('decimal'))).toBe(false);
  });

  it('is never a module or a behavior', () => {
    expect(isValid(withType('module|sales.refunds'))).toBe(false);
    expect(isValid(withType(ISSUE))).toBe(false);
  });

  it('types the inputs and outputs of a behavior the same way', () => {
    const slot = (kind: string, to: string, extra: object) => ({
      kind,
      from: ISSUE,
      to: { value: to },
      cardinality: { value: '*' },
      ...extra,
    });
    const input = (to: string) =>
      slot('has_input', to, { name: 'lines', position: { value: 1 } });
    const output = (to: string) => slot('has_output', to, { name: 'result' });

    expect(
      isValid(
        addingIssue(
          {},
          {
            added: [
              input('building_block|sales.Line'),
              output('primitive|uuid'),
            ],
          },
        ),
      ),
    ).toBe(true);
    expect(
      isValid(addingIssue({}, { added: [input('primitive|money')] })),
    ).toBe(false);
    expect(
      isValid(addingIssue({}, { added: [output('primitive|money')] })),
    ).toBe(false);
  });
});

describe('The visibility of a behavior', () => {
  it('names the actors that may call a public behavior', () => {
    expect(
      isValid(
        addingIssue({
          visibility: { value: { kind: 'public', actors: ['Clerk'] } },
        }),
      ),
    ).toBe(true);
  });

  it('names no actor for a private behavior', () => {
    expect(
      isValid(addingIssue({ visibility: { value: { kind: 'private' } } })),
    ).toBe(true);
    expect(
      isValid(
        addingIssue({
          visibility: { value: { kind: 'private', actors: ['Clerk'] } },
        }),
      ),
    ).toBe(false);
  });
});

describe('A design document an agent wrote', () => {
  const ORDERS = 'module|sales.orders';
  const ORDER = 'building_block|sales.orders.Order';
  const CANCEL = 'behavior|sales.orders.Order.cancel';
  const source = { path: 'src/sales/orders/order.ts' };

  const AUDITABLE = 'building_block|sales.shared.Auditable';
  const PAID_ONLY = 'rule|sales.orders.Paid orders only';
  const CANCELLING_PAID = `scenario|sales.orders.Paid orders only.Cancelling a paid order`;

  /**
   * What the scanner found: the orders module; its Order, which implements
   * Auditable and has a total; Order.cancel, which takes an order, returns a
   * boolean and governs a rule with one scenario.
   */
  const scanned = SystemModel.parse({
    id: '01a0d22d-7f47-76b9-abd4-bd21d66a1d17',
    name: 'shop',
    scanned_at: '2026-09-25T08:00:00.000Z',
    modules: [{ id: ORDERS, name: 'orders', source }],
    buildingBlocks: [
      {
        id: ORDER,
        name: 'Order',
        type: 'aggregate',
        source,
      },
    ],
    rules: [
      {
        id: PAID_ONLY,
        name: 'Paid orders only',
        kind: 'state_change',
        source: { path: 'features/orders.feature' },
      },
    ],
    scenarios: [
      {
        id: CANCELLING_PAID,
        name: 'Cancelling a paid order',
        description: 'The happy path.',
        steps: [
          { kind: 'given', text: 'a paid order' },
          { kind: 'when', text: 'the customer cancels it' },
          { kind: 'then', text: 'the order is cancelled' },
        ],
        source: { path: 'features/orders.feature' },
      },
    ],
    behaviors: [
      {
        id: CANCEL,
        name: 'cancel',
        type: 'Command',
        visibility: { kind: 'private' },
        source,
      },
    ],
    relations: [
      { kind: 'module_contains_block', from: ORDERS, to: ORDER },
      { kind: 'extends', from: ORDER, to: AUDITABLE },
      {
        kind: 'has_state',
        from: ORDER,
        to: 'primitive|decimal',
        name: 'total',
        cardinality: '1',
      },
      { kind: 'exposes', from: ORDER, to: CANCEL },
      { kind: 'governs', from: CANCEL, to: PAID_ONLY },
      { kind: 'illustrates', from: CANCELLING_PAID, to: PAID_ONLY },
      {
        kind: 'has_input',
        from: CANCEL,
        to: ORDER,
        name: 'order',
        cardinality: '1',
        position: 1,
      },
      {
        kind: 'has_output',
        from: CANCEL,
        to: 'primitive|boolean',
        name: 'result',
        cardinality: '1',
      },
    ],
  });

  const validate = (document: unknown, systemModel?: SystemModel) =>
    DesignDocument.validateAgentGenerated(
      DesignDocument.parse(document),
      systemModel,
    );

  describe('for a green field, where nothing is scanned yet', () => {
    it('adds elements', () => {
      expect(validate(greenFieldDesignDocFixture)).toEqual([]);
    });

    it('modifies and removes nothing, as there is nothing yet', () => {
      expect(
        validate(
          design({
            modules: { modified: [{ id: ORDERS }] },
            buildingBlocks: { removed: [ORDER] },
            behaviors: { modified: [{ id: CANCEL }] },
          }),
        ),
      ).toEqual([
        { path: `modules.modified[${ORDERS}]`, reason: 'changedInGreenField' },
        {
          path: `buildingBlocks.removed[${ORDER}]`,
          reason: 'changedInGreenField',
        },
        {
          path: `behaviors.modified[${CANCEL}]`,
          reason: 'changedInGreenField',
        },
      ]);
    });
  });

  describe('for a green field, among its relations', () => {
    it('modifies and removes none either', () => {
      expect(
        validate(
          addingRefund(
            {
              definition: { value: 'Money back.' },
              type: { value: 'aggregate' },
            },
            {
              removed: [{ kind: 'extends', from: REFUND, to: AUDITABLE }],
              modified: [
                {
                  kind: 'has_state',
                  from: REFUND,
                  name: 'legacyFlag',
                  cardinality: { value: '0..1' },
                },
              ],
            },
          ),
        ),
      ).toEqual([
        {
          path: `relations.removed[extends|${REFUND}|${AUDITABLE}]`,
          reason: 'changedInGreenField',
        },
        {
          path: `relations.modified[has_state|${REFUND}|#legacyFlag]`,
          reason: 'changedInGreenField',
        },
      ]);
    });
  });

  describe('against a scanned system model', () => {
    it('modifies and removes the elements the model has', () => {
      expect(
        validate(
          design({
            modules: { modified: [{ id: ORDERS }] },
            buildingBlocks: { modified: [{ id: ORDER }] },
            behaviors: { removed: [CANCEL] },
          }),
          scanned,
        ),
      ).toEqual([]);
    });

    it('never modifies or removes an element the model does not have', () => {
      const missing = 'building_block|sales.orders.OrderLine';

      expect(
        validate(
          design({
            buildingBlocks: { modified: [{ id: missing }] },
            behaviors: { removed: ['behavior|sales.orders.Order.ship'] },
          }),
          scanned,
        ),
      ).toEqual([
        {
          path: `buildingBlocks.modified[${missing}]`,
          reason: 'unknownElement',
        },
        {
          path: 'behaviors.removed[behavior|sales.orders.Order.ship]',
          reason: 'unknownElement',
        },
      ]);
    });

    it('modifies and removes the parts and relations the model has', () => {
      expect(
        validate(
          design({
            rules: {
              modified: [{ id: PAID_ONLY, kind: { value: 'validation' } }],
            },
            scenarios: { removed: [CANCELLING_PAID] },
            relations: {
              removed: [
                { kind: 'illustrates', from: CANCELLING_PAID, to: PAID_ONLY },
                { kind: 'extends', from: ORDER, to: AUDITABLE },
                { kind: 'has_input', from: CANCEL, to: ORDER, name: 'order' },
              ],
              modified: [
                {
                  kind: 'has_state',
                  from: ORDER,
                  name: 'total',
                  to: { value: 'primitive|integer' },
                },
                {
                  kind: 'has_output',
                  from: CANCEL,
                  name: 'result',
                  cardinality: { value: '0..1' },
                },
              ],
            },
          }),
          scanned,
        ),
      ).toEqual([]);
    });

    it('never modifies or removes a part or a relation the model does not have', () => {
      expect(
        validate(
          design({
            rules: { removed: ['rule|sales.orders.Open orders only'] },
            scenarios: {
              removed: [
                `scenario|sales.orders.Paid orders only.Cancelling a shipped order`,
              ],
            },
            relations: {
              removed: [
                {
                  kind: 'has_state',
                  from: ORDER,
                  to: 'primitive|boolean',
                  name: 'legacyFlag',
                },
                { kind: 'has_input', from: CANCEL, to: ORDER, name: 'orders' },
              ],
              modified: [
                {
                  kind: 'has_state',
                  from: ORDER,
                  name: 'discount',
                  cardinality: { value: '1' },
                },
              ],
            },
          }),
          scanned,
        ),
      ).toEqual([
        {
          path: 'rules.removed[rule|sales.orders.Open orders only]',
          reason: 'unknownElement',
        },
        {
          path: 'scenarios.removed[scenario|sales.orders.Paid orders only.Cancelling a shipped order]',
          reason: 'unknownElement',
        },
        {
          path: `relations.removed[has_state|${ORDER}|#legacyFlag]`,
          reason: 'unknownElement',
        },
        {
          path: `relations.removed[has_input|${CANCEL}|#orders]`,
          reason: 'unknownElement',
        },
        {
          path: `relations.modified[has_state|${ORDER}|#discount]`,
          reason: 'unknownElement',
        },
      ]);
    });

    it('ties relations to elements of the design or the model', () => {
      expect(
        validate(
          design({
            relations: {
              added: [
                { kind: 'extends', from: ORDER, to: AUDITABLE },
                { kind: 'exposes', from: ORDER, to: CANCEL },
                {
                  kind: 'has_state',
                  from: ORDER,
                  name: 'paidAt',
                  to: { value: 'primitive|datetime' },
                  cardinality: { value: '0..1' },
                },
              ],
            },
          }),
          scanned,
        ),
      ).toEqual([
        {
          path: `relations.added[extends|${ORDER}|${AUDITABLE}].to`,
          reason: 'unknownRelationEnd',
        },
      ]);
      expect(
        validate(
          design({
            relations: {
              modified: [
                {
                  kind: 'has_state',
                  from: ORDER,
                  name: 'total',
                  to: { value: 'building_block|sales.shared.Money' },
                },
              ],
            },
          }),
          scanned,
        ),
      ).toEqual([
        {
          path: `relations.modified[has_state|${ORDER}|#total].to`,
          reason: 'unknownRelationEnd',
        },
      ]);
    });

    it('adds elements the model does not have yet', () => {
      expect(validate(greenFieldDesignDocFixture, scanned)).toEqual([]);
    });
  });

  describe('whatever it is written against', () => {
    it('writes every field as the agent', () => {
      expect(
        validate(
          design({
            buildingBlocks: {
              modified: [
                {
                  id: ORDER,
                  definition: { value: 'Money back.', author: 'human' },
                },
              ],
            },
          }),
          scanned,
        ),
      ).toEqual([
        {
          path: `buildingBlocks.modified[${ORDER}].definition`,
          reason: 'humanAuthor',
        },
      ]);
    });

    it('gives every field of an added element a value, at any depth', () => {
      expect(
        validate(
          design({
            modules: refundModules,
            buildingBlocks: {
              added: [
                {
                  id: REFUND,
                  type: { value: 'aggregate' },
                  definition: { value: 'Money back.' },
                },
              ],
            },
            relations: {
              added: [
                ...refundContainment,
                {
                  kind: 'has_state',
                  from: ORDER,
                  name: 'refundedAmount',
                  to: { value: 'primitive|decimal' },
                },
              ],
            },
          }),
          scanned,
        ),
      ).toEqual([
        {
          path: `buildingBlocks.added[${REFUND}].name`,
          reason: 'unchangedFieldInAddedItem',
        },
        {
          path: `relations.added[has_state|${ORDER}|#refundedAmount].cardinality`,
          reason: 'unchangedFieldInAddedItem',
        },
      ]);
    });

    it('may leave the diagram of an added element out', () => {
      expect(
        validate(
          addingIssue({
            type: { value: 'Command' },
            definition: { value: 'Issues a refund.' },
            visibility: { value: { kind: 'private' } },
          }),
        ),
      ).toEqual([]);
    });

    it('is contained by the element its id places it under', () => {
      const refund = {
        id: REFUND,
        name: { value: 'Refund' },
        type: { value: 'aggregate' },
        definition: { value: 'Money back.' },
      };
      expect(
        validate(
          design({
            modules: refundModules,
            buildingBlocks: { added: [refund] },
          }),
        ),
      ).toEqual([
        { path: `modules.added[${REFUNDS}]`, reason: 'uncontained' },
        { path: `buildingBlocks.added[${REFUND}]`, reason: 'uncontained' },
      ]);
      expect(
        validate(
          design({
            modules: refundModules,
            buildingBlocks: { added: [refund] },
            relations: { added: refundContainment },
          }),
        ),
      ).toEqual([]);
    });

    it('agrees with the ids on what a module contains', () => {
      const elsewhere = 'building_block|sales.Refund';
      expect(
        validate(
          design({
            modules: refundModules,
            buildingBlocks: {
              added: [
                {
                  id: REFUND,
                  name: { value: 'Refund' },
                  type: { value: 'aggregate' },
                  definition: { value: 'Money back.' },
                },
              ],
            },
            relations: {
              added: [
                ...refundContainment,
                { kind: 'module_contains_block', from: REFUNDS, to: elsewhere },
              ],
            },
          }),
        ),
      ).toEqual([
        {
          path: `relations.added[module_contains_block|${REFUNDS}|${elsewhere}].to`,
          reason: 'unknownRelationEnd',
        },
        {
          path: `relations.added[module_contains_block|${REFUNDS}|${elsewhere}]`,
          reason: 'containmentOutsideIdPath',
        },
      ]);
    });

    it('draws a diagram in its own field, never in a fence of the definition', () => {
      const fenced = 'Issues a refund.\n\n```mermaid\nsequenceDiagram\n```';

      expect(
        validate(
          addingIssue({
            type: { value: 'Command' },
            definition: { value: fenced },
            visibility: { value: { kind: 'private' } },
          }),
        ),
      ).toEqual([
        {
          path: `behaviors.added[${ISSUE}].definition`,
          reason: 'diagramInDefinition',
        },
      ]);
      // A human may still write one, as definitions did before.
      expect(
        DesignDocument.validateHumanEdited(
          DesignDocument.parse(
            addingIssue({
              type: { value: 'Command' },
              definition: { value: fenced },
              visibility: { value: { kind: 'private' } },
            }),
          ),
        ),
      ).toEqual([]);
      expect(
        validate(
          addingIssue({
            type: { value: 'Command' },
            definition: { value: 'Issues a refund.' },
            diagram: { value: 'sequenceDiagram\n  A->>B: issue' },
            visibility: { value: { kind: 'private' } },
          }),
        ),
      ).toEqual([]);
    });

    it('leaves a field of a modified element unchanged', () => {
      expect(
        validate(
          design({ buildingBlocks: { modified: [{ id: ORDER }] } }),
          scanned,
        ),
      ).toEqual([]);
    });

    it('is told every rule it broke at once', () => {
      expect(
        validate(
          design({
            modules: { ...refundModules, removed: [ORDERS] },
            buildingBlocks: {
              added: [
                {
                  id: REFUND,
                  name: { value: 'Refund' },
                  type: { value: 'aggregate', author: 'human' },
                },
              ],
            },
            relations: { added: refundContainment },
          }),
        ),
      ).toEqual([
        { path: `modules.removed[${ORDERS}]`, reason: 'changedInGreenField' },
        {
          path: `buildingBlocks.added[${REFUND}].definition`,
          reason: 'unchangedFieldInAddedItem',
        },
        {
          path: `buildingBlocks.added[${REFUND}].type`,
          reason: 'humanAuthor',
        },
      ]);
    });
  });
});

describe('The needs of a design', () => {
  const need = {
    id: 'refund-single-lines',
    name: { value: 'Refund single lines' },
    stakeholder: { value: 'Support agents' },
    statement: { value: 'Support agents need to refund one line of an order.' },
  };

  it('are none in a design written before designs had needs', () => {
    expect(DesignDocument.parse(design()).needs).toEqual({
      added: [],
      removed: [],
      modified: [],
    });
  });

  it('are each known by a kebab-case id', () => {
    expect(isValid(design({ needs: { added: [need] } }))).toBe(true);
    expect(
      isValid(design({ needs: { added: [{ ...need, id: 'Refund lines' }] } })),
    ).toBe(false);
  });

  it('are only added, as no scan holds a need', () => {
    expect(
      DesignDocument.validateAgentGenerated(
        DesignDocument.parse(
          design({
            needs: {
              added: [need],
              removed: ['retire-credit-notes'],
              modified: [{ id: 'issue-refunds' }],
            },
          }),
        ),
      ),
    ).toEqual([
      {
        path: 'needs.removed[retire-credit-notes]',
        reason: 'changedInGreenField',
      },
      { path: 'needs.modified[issue-refunds]', reason: 'changedInGreenField' },
    ]);
  });

  it('state who needs what, every field of an added one', () => {
    expect(
      DesignDocument.validateAgentGenerated(
        DesignDocument.parse(
          design({ needs: { added: [{ ...need, stakeholder: undefined }] } }),
        ),
      ),
    ).toEqual([
      {
        path: 'needs.added[refund-single-lines].stakeholder',
        reason: 'unchangedFieldInAddedItem',
      },
    ]);
  });
});

describe('A rule of a design', () => {
  const ORDERS = 'module|sales.orders';
  const CANCEL = 'behavior|sales.orders.Order.cancel';
  const PAID_ONLY = 'rule|sales.orders.Paid orders only';
  const source = {
    path: 'features/orders.feature',
    startLine: 3,
    endLine: null,
  };
  const need = {
    id: 'refund-single-lines',
    name: { value: 'Refund single lines' },
    stakeholder: { value: 'Support agents' },
    statement: { value: 'Support agents need to refund one line of an order.' },
  };
  const rule = {
    id: PAID_ONLY,
    name: { value: 'Paid orders only' },
    kind: { value: 'state_change' },
    description: { value: 'Only a paid order is cancelled.' },
    needs: { value: ['refund-single-lines'] },
  };

  const scanned = SystemModel.parse({
    id: '01a0d22d-7f47-76b9-abd4-bd21d66a1d17',
    name: 'shop',
    scanned_at: '2026-09-25T08:00:00.000Z',
    modules: [{ id: ORDERS, name: 'orders', source }],
    buildingBlocks: [
      {
        id: 'building_block|sales.orders.Order',
        name: 'Order',
        type: 'aggregate',
        source,
      },
    ],
    behaviors: [
      {
        id: CANCEL,
        name: 'cancel',
        type: 'Command',
        visibility: { kind: 'private' },
        source,
      },
    ],
    rules: [
      { id: PAID_ONLY, name: 'Paid orders only', kind: 'state_change', source },
    ],
    relations: [{ kind: 'governs', from: CANCEL, to: PAID_ONLY }],
  });

  /** A design adding `rules`, each governed by Order.cancel unless `governed` says otherwise. */
  const addingRules = (
    rules: ({ id: string } & Record<string, unknown>)[],
    {
      needs = [need],
      governed = true,
    }: { needs?: object[]; governed?: boolean } = {},
  ) =>
    design({
      needs: { added: needs },
      rules: { added: rules },
      relations: {
        added: governed
          ? rules.map(({ id }) => ({ kind: 'governs', from: CANCEL, to: id }))
          : [],
      },
    });

  const validate = (document: unknown, systemModel = scanned) =>
    DesignDocument.validateAgentGenerated(
      DesignDocument.parse(document),
      systemModel,
    );

  it('is in the module of the behavior that governs it', () => {
    expect(isValid(design({ rules: { added: [rule] } }))).toBe(true);
    expect(
      isValid(design({ rules: { added: [{ ...rule, id: 'rule|Paid' }] } })),
    ).toBe(false);
  });

  it('reads back with no rationale until one is written', () => {
    const [parsed] = DesignDocument.parse(addingRules([rule])).rules.added;

    expect(parsed?.rationale).toEqual({ changed: false });
  });

  it('traces to needs the design states, or to none as a design decision', () => {
    const DECIDED = 'rule|sales.orders.Decided';
    expect(
      validate(
        addingRules([
          { ...rule, id: 'rule|sales.orders.Paid first' },
          { ...rule, id: DECIDED, needs: { value: [] } },
        ]),
      ),
    ).toEqual([]);
    expect(
      validate(
        addingRules([
          {
            ...rule,
            id: 'rule|sales.orders.Paid first',
            needs: { value: ['issue-refunds'] },
          },
        ]),
      ),
    ).toEqual([
      {
        path: 'rules.added[rule|sales.orders.Paid first].needs[issue-refunds]',
        reason: 'unknownNeed',
      },
    ]);
    expect(
      validate(
        design({
          rules: {
            modified: [{ id: PAID_ONLY, needs: { value: ['issue-refunds'] } }],
          },
        }),
      ),
    ).toEqual([
      {
        path: `rules.modified[${PAID_ONLY}].needs[issue-refunds]`,
        reason: 'unknownNeed',
      },
    ]);
  });

  it('always says its name, kind, description and needs when added, and may leave its rationale out', () => {
    const NEW = 'rule|sales.orders.Paid first';
    expect(
      validate(addingRules([{ id: NEW, name: { value: 'Paid first' } }])),
    ).toEqual([
      { path: `rules.added[${NEW}].kind`, reason: 'unchangedFieldInAddedItem' },
      {
        path: `rules.added[${NEW}].description`,
        reason: 'unchangedFieldInAddedItem',
      },
      {
        path: `rules.added[${NEW}].needs`,
        reason: 'unchangedFieldInAddedItem',
      },
    ]);
  });

  it('enters the design only through a behavior that governs it', () => {
    const NEW = 'rule|sales.orders.Paid first';
    expect(
      validate(addingRules([{ ...rule, id: NEW }], { governed: false })),
    ).toEqual([{ path: `rules.added[${NEW}]`, reason: 'ungovernedRule' }]);
  });

  it('is illustrated by a scenario named under it', () => {
    const SCENARIO = `scenario|sales.orders.Paid first.Unpaid`;
    const adding = (from: string) =>
      design({
        scenarios: {
          added: [
            {
              id: from,
              name: { value: 'Unpaid' },
              description: { value: 'An unpaid order.' },
              steps: {
                value: [{ kind: 'when', text: 'the customer cancels it' }],
              },
            },
          ],
        },
        relations: {
          added: [{ kind: 'illustrates', from, to: PAID_ONLY }],
        },
      });

    expect(
      validate(adding(`scenario|sales.orders.Paid orders only.Unpaid`)),
    ).toEqual([]);
    expect(validate(adding(SCENARIO))).toEqual([
      {
        path: `relations.added[illustrates|${SCENARIO}|${PAID_ONLY}]`,
        reason: 'containmentOutsideIdPath',
      },
    ]);
  });

  it('is governed only by a behavior the design or the model has', () => {
    expect(
      validate(
        design({
          relations: {
            added: [
              {
                kind: 'governs',
                from: 'behavior|sales.orders.Order.ship',
                to: PAID_ONLY,
              },
            ],
          },
        }),
      ),
    ).toEqual([
      {
        path: `relations.added[governs|behavior|sales.orders.Order.ship|${PAID_ONLY}].from`,
        reason: 'unknownRelationEnd',
      },
    ]);
  });
});
