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
 * building blocks and behaviors a change adds, modifies or removes, and the
 * relations between them. An agent writes it; a human reviews it.
 */

const REFUND = 'building_block|sales.refunds.Refund';
const ISSUE = 'behavior|sales.refunds.Refund.issue';

/** A design that changes relations, with the given parts. */
const relating = (relations: object, rest: Record<string, unknown> = {}) =>
  design({ ...rest, relations });

const design = (patch: Record<string, unknown> = {}) => ({
  id: '2026-01-01-partial-refunds',
  name: 'Partial refunds',
  description: 'Let a clerk refund single order lines.',
  ...patch,
});

/** A design that adds one building block, with the given fields. */
const addingRefund = (block: object) =>
  design({
    buildingBlocks: {
      added: [{ id: REFUND, name: { value: 'Refund' }, ...block }],
    },
  });

/** A design that adds one behavior, with the given fields. */
const addingIssue = (behavior: object) =>
  design({
    behaviors: {
      added: [{ id: ISSUE, name: { value: 'issue' }, ...behavior }],
    },
  });

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

    expect(parsed.modules).toEqual({ added: [], removed: [], modified: [] });
    expect(parsed.relations).toEqual({ added: [], removed: [], modified: [] });
    expect(parsed.buildingBlocks.added[0]?.rules).toEqual({
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
        relating({
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
        }),
      ),
    ).toBe(false);
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

  it('removes a rule or a scenario by its name', () => {
    const parsed = DesignDocument.parse(
      addingRefund({
        rules: { removed: ['Refund only paid orders'] },
        scenarios: { removed: ['Refunding a whole order'] },
      }),
    );
    const block = parsed.buildingBlocks.added[0]!;

    expect(block.rules.removed).toEqual(['Refund only paid orders']);
    expect(block.scenarios.removed).toEqual(['Refunding a whole order']);
  });

  it('holds the scenarios of a building block, a behavior and a rule', () => {
    const parsed = DesignDocument.parse(
      addingRefund({
        rules: {
          modified: [
            {
              name: 'Refund only paid orders',
              scenarios: { removed: ['Refunding an unpaid order'] },
            },
          ],
        },
      }),
    );

    expect(
      parsed.buildingBlocks.added[0]?.rules.modified[0]?.scenarios.removed,
    ).toEqual(['Refunding an unpaid order']);
    expect(
      isValid(addingIssue({ scenarios: { removed: ['Refunding'] } })),
    ).toBe(true);
  });

  it('adds and removes a relation of every kind the model has, each by its kind and ends', () => {
    const AUDITABLE = 'building_block|sales.shared.Auditable';
    const parsed = DesignDocument.parse(
      relating({
        added: [
          { kind: 'extends', from: REFUND, to: AUDITABLE },
          { kind: 'contains', from: 'module|sales.refunds', to: REFUND },
          { kind: 'exposes', from: REFUND, to: ISSUE },
          {
            kind: 'invokes',
            from: ISSUE,
            to: 'behavior|sales.ledger.Ledger.post',
            order: { value: 1 },
          },
        ],
        removed: [
          { kind: 'extends', from: REFUND, to: 'building_block|sales.Legacy' },
          { kind: 'invokes', from: ISSUE, to: 'behavior|sales.Old.notify' },
        ],
      }),
    );

    expect(parsed.relations.added.map((r) => r.kind)).toEqual([
      'extends',
      'contains',
      'exposes',
      'invokes',
    ]);
    expect<unknown>(parsed.relations.removed).toEqual([
      { kind: 'extends', from: REFUND, to: 'building_block|sales.Legacy' },
      { kind: 'invokes', from: ISSUE, to: 'behavior|sales.Old.notify' },
    ]);
    expect(
      isValid(relating({ added: [{ kind: 'extends', from: REFUND }] })),
    ).toBe(false);
    expect(
      isValid(
        relating({ added: [{ kind: 'extends', from: REFUND, to: ISSUE }] }),
      ),
    ).toBe(false);
    expect(
      isValid(relating({ added: [{ kind: 'owns', from: REFUND, to: ISSUE }] })),
    ).toBe(false);
  });

  it('knows a piece of state and an input by their holder and name, so their type and cardinality are fields', () => {
    const parsed = DesignDocument.parse(
      relating({
        added: [
          {
            kind: 'has_input',
            from: ISSUE,
            name: 'lines',
            to: { value: 'building_block|sales.refunds.RefundLine' },
            cardinality: { value: '1..*' },
            position: { value: 1 },
          },
        ],
        removed: [
          { kind: 'has_state', from: REFUND, name: 'legacyFlag' },
          { kind: 'has_input', from: ISSUE, name: 'note' },
        ],
        modified: [
          {
            kind: 'has_state',
            from: REFUND,
            name: 'total',
            cardinality: { value: '0..1' },
          },
          {
            kind: 'has_input',
            from: ISSUE,
            name: 'reason',
            to: { value: 'primitive|string' },
          },
        ],
      }),
    );

    expect<unknown>(parsed.relations.removed).toEqual([
      { kind: 'has_state', from: REFUND, name: 'legacyFlag' },
      { kind: 'has_input', from: ISSUE, name: 'note' },
    ]);
    expect(parsed.relations.modified[0]).toMatchObject({
      name: 'total',
      to: { changed: false },
      cardinality: { changed: true, value: '0..1', author: 'agent' },
    });
    expect(parsed.relations.modified[1]).toMatchObject({
      name: 'reason',
      to: { changed: true, value: 'primitive|string' },
      cardinality: { changed: false },
    });
    expect(
      isValid(
        relating({
          added: [
            {
              kind: 'has_state',
              from: REFUND,
              to: { value: 'primitive|decimal' },
              cardinality: { value: '1' },
            },
          ],
        }),
      ),
    ).toBe(false);
    expect(
      isValid(
        relating({
          removed: [{ kind: 'has_state', from: REFUND, to: REFUND }],
        }),
      ),
    ).toBe(false);
  });

  it('knows an output by its type and a call by its target, so only the cardinality or the order is a field', () => {
    const parsed = DesignDocument.parse(
      relating({
        removed: [{ kind: 'has_output', from: ISSUE, to: 'primitive|boolean' }],
        modified: [
          {
            kind: 'has_output',
            from: ISSUE,
            to: REFUND,
            cardinality: { value: '0..1' },
          },
          {
            kind: 'invokes',
            from: ISSUE,
            to: 'behavior|sales.ledger.Ledger.post',
            order: { value: 2 },
          },
        ],
      }),
    );

    expect<unknown>(parsed.relations.removed).toEqual([
      { kind: 'has_output', from: ISSUE, to: 'primitive|boolean' },
    ]);
    expect<unknown>(parsed.relations.modified.map((r) => r.to)).toEqual([
      REFUND,
      'behavior|sales.ledger.Ledger.post',
    ]);
    expect(
      isValid(
        relating({
          added: [
            {
              kind: 'has_output',
              from: ISSUE,
              to: REFUND,
              name: 'refund',
              cardinality: { value: '1' },
            },
          ],
        }),
      ),
    ).toBe(false);
    expect(
      isValid(
        relating({
          added: [
            {
              kind: 'has_output',
              from: ISSUE,
              to: { value: REFUND },
              cardinality: { value: '1' },
            },
          ],
        }),
      ),
    ).toBe(false);
    expect(
      isValid(
        relating({
          added: [
            { kind: 'invokes', from: ISSUE, to: REFUND, order: { value: 1 } },
          ],
        }),
      ),
    ).toBe(false);
  });

  it('classifies a building block, a behavior and a rule only by the known types', () => {
    expect(isValid(addingRefund({ type: { value: 'aggregate' } }))).toBe(true);
    expect(isValid(addingRefund({ type: { value: 'controller' } }))).toBe(
      false,
    );
    expect(isValid(addingIssue({ type: { value: 'Command' } }))).toBe(true);
    expect(isValid(addingIssue({ type: { value: 'Request' } }))).toBe(false);
    expect(
      isValid(
        addingRefund({
          rules: {
            added: [{ name: 'Paid only', ruleType: { value: 'Validation' } }],
          },
        }),
      ),
    ).toBe(false);
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

describe('The type of a piece of state, an input or an output', () => {
  const withType = (type: unknown) =>
    relating({
      added: [
        {
          kind: 'has_state',
          from: REFUND,
          name: 'amount',
          to: { value: type },
          cardinality: { value: '1' },
        },
      ],
    });

  it('is a building block of the model or a primitive; a collection is said by the cardinality', () => {
    expect(isValid(withType('building_block|sales.shared.Money'))).toBe(true);
    expect(isValid(withType('primitive|decimal'))).toBe(true);
    expect(isValid(withType({ collectionOf: 'primitive|string' }))).toBe(false);
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
    expect(
      isValid(
        relating({
          added: [
            {
              kind: 'has_input',
              from: ISSUE,
              name: 'lines',
              to: { value: 'building_block|sales.Line' },
              cardinality: { value: '0..*' },
              position: { value: 1 },
            },
            {
              kind: 'has_output',
              from: ISSUE,
              to: 'primitive|uuid',
              cardinality: { value: '1' },
            },
          ],
        }),
      ),
    ).toBe(true);
    expect(
      isValid(
        relating({
          added: [
            {
              kind: 'has_input',
              from: ISSUE,
              name: 'total',
              to: { value: 'primitive|money' },
              cardinality: { value: '1' },
              position: { value: 1 },
            },
          ],
        }),
      ),
    ).toBe(false);
    expect(
      isValid(
        relating({
          added: [
            {
              kind: 'has_output',
              from: ISSUE,
              to: 'primitive|money',
              cardinality: { value: '1' },
            },
          ],
        }),
      ),
    ).toBe(false);
  });

  it('holds one of four cardinalities', () => {
    for (const cardinality of ['0..1', '1', '0..*', '1..*']) {
      expect(
        isValid(
          relating({
            added: [
              {
                kind: 'has_output',
                from: ISSUE,
                to: REFUND,
                cardinality: { value: cardinality },
              },
            ],
          }),
        ),
      ).toBe(true);
    }
    expect(
      isValid(
        relating({
          added: [
            {
              kind: 'has_output',
              from: ISSUE,
              to: REFUND,
              cardinality: { value: 'many' },
            },
          ],
        }),
      ),
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

  /**
   * What the scanner found: the orders module; its Order, which extends
   * Auditable, has a total and a rule with one scenario; and Order.cancel,
   * which takes an order and returns a boolean.
   */
  const scanned = SystemModel.parse({
    id: '01a0d22d-7f47-76b9-abd4-bd21d66a1d17',
    name: 'shop',
    scanned_at: '2026-09-25T08:00:00.000Z',
    modules: [{ id: ORDERS, name: 'orders', source }],
    relations: [
      { kind: 'contains', from: ORDERS, to: ORDER },
      { kind: 'extends', from: ORDER, to: AUDITABLE },
      {
        kind: 'has_state',
        from: ORDER,
        to: 'primitive|decimal',
        name: 'total',
        cardinality: '1',
      },
      { kind: 'exposes', from: ORDER, to: CANCEL },
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
        cardinality: '1',
      },
    ],
    buildingBlocks: [
      {
        id: ORDER,
        name: 'Order',
        type: 'aggregate',
        rules: [
          {
            name: 'Paid orders only',
            ruleType: 'State change',
            scenarios: [
              {
                name: 'Cancelling a paid order',
                description: 'The happy path.',
                steps: [
                  { kind: 'given', text: 'a paid order' },
                  { kind: 'when', text: 'the customer cancels it' },
                  { kind: 'then', text: 'the order is cancelled' },
                ],
              },
            ],
          },
        ],
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

  describe('for a green field, among the relations', () => {
    it('modifies and removes nothing either', () => {
      expect(
        validate(
          relating({
            removed: [
              { kind: 'extends', from: ORDER, to: AUDITABLE },
              { kind: 'has_state', from: ORDER, name: 'legacyFlag' },
            ],
            modified: [
              {
                kind: 'has_input',
                from: CANCEL,
                name: 'order',
                cardinality: { value: '0..1' },
              },
            ],
          }),
        ),
      ).toEqual([
        {
          path: `relations.removed[extends|${ORDER}|${AUDITABLE}]`,
          reason: 'changedInGreenField',
        },
        {
          path: `relations.removed[has_state|${ORDER}|#legacyFlag]`,
          reason: 'changedInGreenField',
        },
        {
          path: `relations.modified[has_input|${CANCEL}|#order]`,
          reason: 'changedInGreenField',
        },
      ]);
    });

    it('joins only elements it adds: nothing else exists yet', () => {
      expect(
        validate(
          relating(
            {
              added: [
                { kind: 'extends', from: REFUND, to: AUDITABLE },
                {
                  kind: 'has_state',
                  from: REFUND,
                  name: 'orderId',
                  to: { value: 'building_block|sales.orders.OrderId' },
                  cardinality: { value: '1' },
                },
                {
                  kind: 'has_state',
                  from: REFUND,
                  name: 'total',
                  to: { value: 'primitive|decimal' },
                  cardinality: { value: '1' },
                },
                {
                  kind: 'invokes',
                  from: ISSUE,
                  to: CANCEL,
                  order: { value: 1 },
                },
              ],
            },
            {
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
            },
          ),
        ),
      ).toEqual([
        {
          path: `relations.added[extends|${REFUND}|${AUDITABLE}].to`,
          reason: 'unknownRelationEnd',
        },
        {
          path: `relations.added[has_state|${REFUND}|#orderId].to`,
          reason: 'unknownRelationEnd',
        },
        {
          path: `relations.added[invokes|${ISSUE}|${CANCEL}].from`,
          reason: 'unknownRelationEnd',
        },
        {
          path: `relations.added[invokes|${ISSUE}|${CANCEL}].to`,
          reason: 'unknownRelationEnd',
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

    it('modifies and removes the parts of an element, and the relations, that the model has', () => {
      expect(
        validate(
          design({
            relations: {
              removed: [
                { kind: 'extends', from: ORDER, to: AUDITABLE },
                { kind: 'has_input', from: CANCEL, name: 'order' },
              ],
              modified: [
                {
                  kind: 'has_state',
                  from: ORDER,
                  name: 'total',
                  cardinality: { value: '0..1' },
                },
                {
                  kind: 'has_output',
                  from: CANCEL,
                  to: 'primitive|boolean',
                  cardinality: { value: '0..1' },
                },
              ],
            },
            buildingBlocks: {
              modified: [
                {
                  id: ORDER,
                  rules: {
                    modified: [
                      {
                        name: 'Paid orders only',
                        scenarios: { removed: ['Cancelling a paid order'] },
                      },
                    ],
                  },
                },
              ],
            },
            behaviors: { modified: [{ id: CANCEL }] },
          }),
          scanned,
        ),
      ).toEqual([]);
    });

    it('never modifies or removes a part, or a relation, the model does not have', () => {
      expect(
        validate(
          design({
            relations: {
              removed: [
                { kind: 'has_state', from: ORDER, name: 'legacyFlag' },
                { kind: 'has_input', from: CANCEL, name: 'orders' },
                { kind: 'has_output', from: CANCEL, to: ORDER },
              ],
              modified: [{ kind: 'has_state', from: ORDER, name: 'discount' }],
            },
            buildingBlocks: {
              modified: [
                {
                  id: ORDER,
                  rules: {
                    removed: ['Open orders only'],
                    modified: [
                      {
                        name: 'Paid orders only',
                        scenarios: { removed: ['Cancelling a shipped order'] },
                      },
                    ],
                  },
                },
              ],
            },
          }),
          scanned,
        ),
      ).toEqual([
        {
          path: `buildingBlocks.modified[${ORDER}].rules.removed[Open orders only]`,
          reason: 'unknownElement',
        },
        {
          path: `buildingBlocks.modified[${ORDER}].rules.modified[Paid orders only].scenarios.removed[Cancelling a shipped order]`,
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
          path: `relations.removed[has_output|${CANCEL}|${ORDER}]`,
          reason: 'unknownElement',
        },
        {
          path: `relations.modified[has_state|${ORDER}|#discount]`,
          reason: 'unknownElement',
        },
      ]);
    });

    it('joins elements it adds to elements the model has', () => {
      expect(
        validate(
          relating(
            {
              added: [
                { kind: 'extends', from: REFUND, to: ORDER },
                {
                  kind: 'has_state',
                  from: ORDER,
                  name: 'refund',
                  to: { value: REFUND },
                  cardinality: { value: '0..1' },
                },
                {
                  kind: 'invokes',
                  from: CANCEL,
                  to: ISSUE,
                  order: { value: 1 },
                },
                { kind: 'exposes', from: REFUND, to: ISSUE },
                { kind: 'contains', from: ORDERS, to: REFUND },
                { kind: 'exposes', from: ORDER, to: ISSUE },
              ],
            },
            {
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
              behaviors: {
                added: [
                  {
                    id: ISSUE,
                    name: { value: 'issue' },
                    type: { value: 'Command' },
                    definition: { value: 'Issues it.' },
                    visibility: { value: { kind: 'private' } },
                  },
                ],
              },
            },
          ),
          scanned,
        ),
      ).toEqual([
        {
          path: `relations.added[contains|${ORDERS}|${REFUND}]`,
          reason: 'containmentOutsideIdPath',
        },
        {
          path: `relations.added[exposes|${ORDER}|${ISSUE}]`,
          reason: 'containmentOutsideIdPath',
        },
      ]);
    });

    it('reports an element the model does not have once, not each part changed under it', () => {
      const missing = 'building_block|sales.orders.OrderLine';

      expect(
        validate(
          design({
            buildingBlocks: {
              modified: [{ id: missing, rules: { removed: ['Paid'] } }],
            },
          }),
          scanned,
        ),
      ).toEqual([
        {
          path: `buildingBlocks.modified[${missing}]`,
          reason: 'unknownElement',
        },
      ]);
    });

    it('modifies and removes nothing inside an element it adds', () => {
      expect(
        validate(
          addingRefund({
            definition: { value: 'Money back.' },
            type: { value: 'aggregate' },
            rules: { removed: ['Paid orders only'] },
          }),
          scanned,
        ),
      ).toEqual([
        {
          path: `buildingBlocks.added[${REFUND}].rules.removed[Paid orders only]`,
          reason: 'unknownElement',
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
            buildingBlocks: {
              added: [
                {
                  id: REFUND,
                  type: { value: 'aggregate' },
                  definition: { value: 'Money back.' },
                },
              ],
              modified: [{ id: ORDER }],
            },
            relations: {
              added: [
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
            modules: { removed: [ORDERS] },
            buildingBlocks: {
              added: [
                {
                  id: REFUND,
                  name: { value: 'Refund' },
                  type: { value: 'aggregate', author: 'human' },
                },
              ],
            },
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
  const SALES = 'module|sales';
  const ORDER = 'building_block|sales.Order';
  const source = { path: 'src/sales' };
  const need = {
    id: 'refund-single-lines',
    name: { value: 'Refund single lines' },
    stakeholder: { value: 'Support agents' },
    statement: { value: 'Support agents need to refund one line of an order.' },
  };
  const businessRule = {
    name: 'Paid orders only',
    category: { value: 'Business' },
    ruleType: { value: 'State change' },
    description: { value: 'Only a paid order is refunded.' },
    needs: { value: ['refund-single-lines'] },
  };
  const qualityRule = {
    name: 'Fast refunds',
    category: { value: 'Quality' },
    ruleType: { value: 'Performance' },
    description: { value: 'A refund is issued within a second.' },
    needs: { value: [] },
  };

  const scanned = SystemModel.parse({
    id: '01a0d22d-7f47-76b9-abd4-bd21d66a1d17',
    name: 'shop',
    scanned_at: '2026-09-25T08:00:00.000Z',
    modules: [
      {
        id: SALES,
        name: 'sales',
        rules: [
          {
            name: 'Fast refunds',
            category: 'Quality',
            ruleType: 'Performance',
          },
        ],
        source,
      },
    ],
    buildingBlocks: [
      {
        id: ORDER,
        name: 'Order',
        type: 'aggregate',
        rules: [{ name: 'Paid orders only', ruleType: 'State change' }],
        source,
      },
    ],
  });

  const addingRules = (
    rules: { block?: object[]; module?: object[] },
    needs: object[] = [need],
  ) =>
    design({
      needs: { added: needs },
      modules: {
        added: [
          {
            id: 'module|billing',
            name: { value: 'billing' },
            definition: { value: 'Charging customers.' },
            rules: { added: rules.module ?? [] },
          },
        ],
      },
      buildingBlocks: {
        added: [
          {
            id: 'building_block|billing.Invoice',
            name: { value: 'Invoice' },
            type: { value: 'aggregate' },
            definition: { value: 'What a customer is asked to pay.' },
            rules: { added: rules.block ?? [] },
          },
        ],
      },
    });

  const validate = (document: unknown, systemModel?: SystemModel) =>
    DesignDocument.validateAgentGenerated(
      DesignDocument.parse(document),
      systemModel,
    );

  it('reads back a rule written before rules had a category, needs or a rationale', () => {
    const rule = DesignDocument.parse(
      addingRules({ block: [{ name: 'Paid orders only' }] }),
    ).buildingBlocks.added[0]!.rules.added[0]!;

    expect(rule.category).toEqual({ changed: false });
    expect(rule.needs).toEqual({ changed: false });
    expect(rule.rationale).toEqual({ changed: false });
  });

  it('traces to needs the design states, or to none as a design decision', () => {
    expect(
      validate(
        addingRules({
          block: [
            businessRule,
            { ...businessRule, name: 'Decided', needs: { value: [] } },
          ],
          module: [qualityRule],
        }),
      ),
    ).toEqual([]);
    expect(
      validate(
        addingRules({
          block: [{ ...businessRule, needs: { value: ['issue-refunds'] } }],
        }),
      ),
    ).toEqual([
      {
        path: 'buildingBlocks.added[building_block|billing.Invoice].rules.added[Paid orders only].needs[issue-refunds]',
        reason: 'unknownNeed',
      },
    ]);
  });

  it('always says its category and its needs when added, and may leave its rationale out', () => {
    expect(
      validate(
        addingRules({
          block: [
            { ...businessRule, category: undefined, needs: undefined },
            { ...businessRule, name: 'Reasoned', rationale: { value: 'Why.' } },
          ],
        }),
      ),
    ).toEqual([
      {
        path: 'buildingBlocks.added[building_block|billing.Invoice].rules.added[Paid orders only].category',
        reason: 'unchangedFieldInAddedItem',
      },
      {
        path: 'buildingBlocks.added[building_block|billing.Invoice].rules.added[Paid orders only].needs',
        reason: 'unchangedFieldInAddedItem',
      },
    ]);
  });

  it('has a type of its own category', () => {
    expect(
      validate(
        addingRules({
          block: [{ ...businessRule, ruleType: { value: 'Performance' } }],
        }),
      ),
    ).toEqual([
      {
        path: 'buildingBlocks.added[building_block|billing.Invoice].rules.added[Paid orders only].ruleType',
        reason: 'ruleTypeOutsideCategory',
      },
    ]);
  });

  it('keeps a modified rule to the category or type the scan has for the half it leaves alone', () => {
    const modifying = (rule: object) =>
      design({
        buildingBlocks: {
          modified: [{ id: ORDER, rules: { modified: [rule] } }],
        },
      });

    expect(
      validate(
        modifying({
          name: 'Paid orders only',
          ruleType: { value: 'Structure' },
        }),
        scanned,
      ),
    ).toEqual([]);
    expect(
      validate(
        modifying({
          name: 'Paid orders only',
          ruleType: { value: 'Reliability' },
        }),
        scanned,
      ),
    ).toEqual([
      {
        path: `buildingBlocks.modified[${ORDER}].rules.modified[Paid orders only].ruleType`,
        reason: 'ruleTypeOutsideCategory',
      },
    ]);
    expect(
      validate(
        modifying({ name: 'Paid orders only', category: { value: 'Quality' } }),
        scanned,
      ),
    ).toEqual([
      {
        path: `buildingBlocks.modified[${ORDER}].rules.modified[Paid orders only].ruleType`,
        reason: 'ruleTypeOutsideCategory',
      },
    ]);
  });

  it('on a module is a quality or constraint rule, never a business one', () => {
    expect(validate(addingRules({ module: [businessRule] }))).toEqual([
      {
        path: 'modules.added[module|billing].rules.added[Paid orders only].category',
        reason: 'businessRuleOnModule',
      },
    ]);
    expect(
      validate(
        design({
          modules: {
            modified: [
              {
                id: SALES,
                rules: {
                  modified: [
                    {
                      name: 'Fast refunds',
                      description: { value: 'Within half a second.' },
                    },
                  ],
                },
              },
            ],
          },
        }),
        scanned,
      ),
    ).toEqual([]);
  });
});
