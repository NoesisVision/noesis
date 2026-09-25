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
 * building blocks and behaviours a change adds, modifies or removes. An agent
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

/** A design that adds one building block, with the given fields. */
const addingRefund = (block: object) =>
  design({
    buildingBlocks: {
      added: [{ id: REFUND, name: { value: 'Refund' }, ...block }],
    },
  });

/** A design that adds one behaviour, with the given fields. */
const addingIssue = (behaviour: object) =>
  design({
    behaviours: {
      added: [{ id: ISSUE, name: { value: 'issue' }, ...behaviour }],
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
    expect(parsed.buildingBlocks.added[0]?.properties).toEqual({
      added: [],
      removed: [],
      modified: [],
    });
    expect(parsed.buildingBlocks.added[0]?.implements).toEqual({
      added: [],
      removed: [],
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
        addingRefund({
          properties: { added: [{ name: 'total', optionl: { value: true } }] },
        }),
      ),
    ).toBe(false);
  });

  it('reads back exactly as it was written', () => {
    const parsed = DesignDocument.parse(designDocFixture);

    expect(z.encode(DesignDocument, parsed)).toEqual(designDocFixture);
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

  it('names a module, a building block and a behaviour each by an id of its own kind', () => {
    expect(isValid(design({ modules: { added: [{ id: REFUND }] } }))).toBe(
      false,
    );
    expect(
      isValid(
        design({ buildingBlocks: { removed: ['module|sales.refunds'] } }),
      ),
    ).toBe(false);
    expect(isValid(design({ behaviours: { removed: [REFUND] } }))).toBe(false);
  });

  it('removes a property, a rule or a scenario by its name', () => {
    const parsed = DesignDocument.parse(
      addingRefund({
        properties: { removed: ['legacyFlag'] },
        rules: { removed: ['Refund only paid orders'] },
        scenarios: { removed: ['Refunding a whole order'] },
      }),
    );
    const block = parsed.buildingBlocks.added[0]!;

    expect(block.properties.removed).toEqual(['legacyFlag']);
    expect(block.rules.removed).toEqual(['Refund only paid orders']);
    expect(block.scenarios.removed).toEqual(['Refunding a whole order']);
  });

  it('holds the scenarios of a building block, a behaviour and a rule', () => {
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

  it('adds and removes an implemented interface by its id', () => {
    const parsed = DesignDocument.parse(
      design({
        buildingBlocks: {
          modified: [
            {
              id: REFUND,
              implements: {
                added: ['building_block|sales.shared.Auditable'],
                removed: ['building_block|sales.shared.Legacy'],
              },
            },
          ],
        },
      }),
    );

    expect<object | undefined>(
      parsed.buildingBlocks.modified[0]?.implements,
    ).toEqual({
      added: ['building_block|sales.shared.Auditable'],
      removed: ['building_block|sales.shared.Legacy'],
    });
  });

  it('never modifies an implemented interface, an input or an output: it removes one and adds another', () => {
    const modifying = (part: string) =>
      design({
        behaviours: {
          modified: [{ id: ISSUE, [part]: { modified: [REFUND] } }],
        },
      });

    expect(
      isValid(
        design({
          buildingBlocks: {
            modified: [{ id: REFUND, implements: { modified: [REFUND] } }],
          },
        }),
      ),
    ).toBe(false);
    expect(isValid(modifying('input'))).toBe(false);
    expect(isValid(modifying('output'))).toBe(false);
  });

  it('classifies a building block, a behaviour and a rule only by the known types', () => {
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

    expect(block.description).toEqual({ changed: false });
  });

  it('is a change when it has a value, written by the agent unless a human wrote it', () => {
    const block = DesignDocument.parse(
      addingRefund({
        description: { value: 'Money back.' },
        type: { value: 'aggregate', author: 'human' },
      }),
    ).buildingBlocks.added[0]!;

    expect(block.description).toEqual({
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
      isValid(addingRefund({ description: { changed: false, value: 'x' } })),
    ).toBe(false);
    expect(
      isValid(
        addingRefund({ description: { changed: false, author: 'human' } }),
      ),
    ).toBe(false);
  });

  it('is written either by an agent or by a human', () => {
    expect(
      isValid(addingRefund({ description: { value: 'x', author: 'bot' } })),
    ).toBe(false);
  });
});

describe('The type of a property, an input or an output', () => {
  const withType = (type: unknown) =>
    addingRefund({
      properties: { added: [{ name: 'amount', type: { value: type } }] },
    });

  it('is a building block of the model, a primitive, or a collection of either', () => {
    expect(isValid(withType('building_block|sales.shared.Money'))).toBe(true);
    expect(isValid(withType('primitive|decimal'))).toBe(true);
    expect(isValid(withType({ collectionOf: 'primitive|string' }))).toBe(true);
    expect(
      isValid(withType({ collectionOf: { collectionOf: 'primitive|string' } })),
    ).toBe(true);
  });

  it('knows only its own primitives, each named as a primitive', () => {
    expect(isValid(withType('primitive|money'))).toBe(false);
    expect(isValid(withType('decimal'))).toBe(false);
  });

  it('is never a module or a behaviour', () => {
    expect(isValid(withType('module|sales.refunds'))).toBe(false);
    expect(isValid(withType(ISSUE))).toBe(false);
  });

  it('types the inputs and outputs of a behaviour the same way', () => {
    expect(
      isValid(
        addingIssue({
          input: { added: [{ collectionOf: 'building_block|sales.Line' }] },
          output: { added: ['primitive|uuid'] },
        }),
      ),
    ).toBe(true);
    expect(
      isValid(addingIssue({ input: { added: ['primitive|money'] } })),
    ).toBe(false);
  });
});

describe('The visibility of a behaviour', () => {
  it('names the actors that may call a public behaviour', () => {
    expect(
      isValid(
        addingIssue({
          visibility: { value: { kind: 'public', actors: ['Clerk'] } },
        }),
      ),
    ).toBe(true);
  });

  it('names no actor for a private behaviour', () => {
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
   * What the scanner found: the orders module; its Order, which implements
   * Auditable, has a total and a rule with one scenario; and Order.cancel,
   * which takes an Order.
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
        implements: [AUDITABLE],
        properties: [{ name: 'total', type: 'primitive|decimal' }],
        rules: [
          {
            name: 'Paid orders only',
            ruleType: 'State change',
            scenarios: [
              {
                name: 'Cancelling a paid order',
                description: 'The happy path.',
                given: 'a paid order',
                when: 'the customer cancels it',
                // oxlint-disable-next-line unicorn/no-thenable
                then: 'the order is cancelled', // NOSONAR
              },
            ],
          },
        ],
        source,
      },
    ],
    behaviours: [
      {
        id: CANCEL,
        buildingBlockId: ORDER,
        name: 'cancel',
        type: 'Command',
        visibility: { kind: 'private' },
        input: [ORDER],
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
            behaviours: { modified: [{ id: CANCEL }] },
          }),
        ),
      ).toEqual([
        { path: `modules.modified[${ORDERS}]`, reason: 'changedInGreenField' },
        {
          path: `buildingBlocks.removed[${ORDER}]`,
          reason: 'changedInGreenField',
        },
        {
          path: `behaviours.modified[${CANCEL}]`,
          reason: 'changedInGreenField',
        },
      ]);
    });
  });

  describe('for a green field, inside an element it adds', () => {
    it('modifies and removes nothing either', () => {
      expect(
        validate(
          addingRefund({
            description: { value: 'Money back.' },
            type: { value: 'aggregate' },
            implements: { removed: [AUDITABLE] },
            properties: { removed: ['legacyFlag'] },
          }),
        ),
      ).toEqual([
        {
          path: `buildingBlocks.added[${REFUND}].implements.removed[${AUDITABLE}]`,
          reason: 'changedInGreenField',
        },
        {
          path: `buildingBlocks.added[${REFUND}].properties.removed[legacyFlag]`,
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
            behaviours: { removed: [CANCEL] },
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
            behaviours: { removed: ['behavior|sales.orders.Order.ship'] },
          }),
          scanned,
        ),
      ).toEqual([
        {
          path: `buildingBlocks.modified[${missing}]`,
          reason: 'unknownElement',
        },
        {
          path: 'behaviours.removed[behavior|sales.orders.Order.ship]',
          reason: 'unknownElement',
        },
      ]);
    });

    it('modifies and removes the parts of an element that the model has', () => {
      expect(
        validate(
          design({
            buildingBlocks: {
              modified: [
                {
                  id: ORDER,
                  implements: { removed: [AUDITABLE] },
                  properties: {
                    modified: [
                      { name: 'total', description: { value: 'The sum.' } },
                    ],
                  },
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
            behaviours: {
              modified: [
                {
                  id: CANCEL,
                  input: { removed: [ORDER] },
                },
              ],
            },
          }),
          scanned,
        ),
      ).toEqual([]);
    });

    it('never modifies or removes a part the element in the model does not have', () => {
      expect(
        validate(
          design({
            buildingBlocks: {
              modified: [
                {
                  id: ORDER,
                  properties: {
                    removed: ['legacyFlag'],
                    modified: [{ name: 'discount' }],
                  },
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
            behaviours: {
              modified: [
                {
                  id: CANCEL,
                  output: { removed: ['primitive|boolean'] },
                  input: { removed: [{ collectionOf: ORDER }] },
                },
              ],
            },
          }),
          scanned,
        ),
      ).toEqual([
        {
          path: `buildingBlocks.modified[${ORDER}].properties.removed[legacyFlag]`,
          reason: 'unknownElement',
        },
        {
          path: `buildingBlocks.modified[${ORDER}].properties.modified[discount]`,
          reason: 'unknownElement',
        },
        {
          path: `buildingBlocks.modified[${ORDER}].rules.removed[Open orders only]`,
          reason: 'unknownElement',
        },
        {
          path: `buildingBlocks.modified[${ORDER}].rules.modified[Paid orders only].scenarios.removed[Cancelling a shipped order]`,
          reason: 'unknownElement',
        },
        {
          path: `behaviours.modified[${CANCEL}].input.removed[{"collectionOf":"${ORDER}"}]`,
          reason: 'unknownElement',
        },
        {
          path: `behaviours.modified[${CANCEL}].output.removed[primitive|boolean]`,
          reason: 'unknownElement',
        },
      ]);
    });

    it('reports an element the model does not have once, not each part changed under it', () => {
      const missing = 'building_block|sales.orders.OrderLine';

      expect(
        validate(
          design({
            buildingBlocks: {
              modified: [{ id: missing, properties: { removed: ['total'] } }],
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
            description: { value: 'Money back.' },
            type: { value: 'aggregate' },
            properties: { removed: ['total'] },
          }),
          scanned,
        ),
      ).toEqual([
        {
          path: `buildingBlocks.added[${REFUND}].properties.removed[total]`,
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
                  description: { value: 'Money back.', author: 'human' },
                },
              ],
            },
          }),
          scanned,
        ),
      ).toEqual([
        {
          path: `buildingBlocks.modified[${ORDER}].description`,
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
                  description: { value: 'Money back.' },
                },
              ],
              modified: [
                {
                  id: ORDER,
                  properties: {
                    added: [
                      {
                        name: 'refundedAmount',
                        type: { value: 'primitive|decimal' },
                        optional: { value: false },
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
          path: `buildingBlocks.added[${REFUND}].name`,
          reason: 'unchangedFieldInAddedItem',
        },
        {
          path: `buildingBlocks.modified[${ORDER}].properties.added[refundedAmount].description`,
          reason: 'unchangedFieldInAddedItem',
        },
      ]);
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
          path: `buildingBlocks.added[${REFUND}].description`,
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
