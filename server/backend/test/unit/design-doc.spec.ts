import { describe, expect, it } from 'bun:test';
import { z } from 'zod';
import {
  DesignDocument,
  DesignedRelationKey,
} from '#backend/app/design-docs/design-doc';
import { NAMED_SLOT_KINDS } from '#backend/app/design-docs/relation-key';
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
    expect(parsed.rules).toEqual({ added: [], removed: [], modified: [] });
    expect(parsed.scenarios).toEqual({ added: [], removed: [], modified: [] });
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

  it('adds and removes a relation of every kind the model has, each by its kind and ends', () => {
    const AUDITABLE = 'building_block|sales.shared.Auditable';
    const parsed = DesignDocument.parse(
      relating({
        added: [
          { kind: 'extends', from: REFUND, to: AUDITABLE },
          {
            kind: 'module_contains_block',
            from: 'module|sales.refunds',
            to: REFUND,
          },
          { kind: 'exposes', from: REFUND, to: ISSUE },
          {
            kind: 'behavior_invokes_behavior',
            from: ISSUE,
            to: 'behavior|sales.ledger.Ledger.post',
            order: { value: 1 },
          },
          { kind: 'governs', from: ISSUE, to: 'rule|sales.refunds.Paid only' },
          {
            kind: 'illustrates',
            from: 'scenario|sales.refunds.Paid only.Unpaid',
            to: 'rule|sales.refunds.Paid only',
          },
        ],
        removed: [
          { kind: 'extends', from: REFUND, to: 'building_block|sales.Legacy' },
          {
            kind: 'behavior_invokes_behavior',
            from: ISSUE,
            to: 'behavior|sales.Old.notify',
          },
        ],
      }),
    );

    expect(parsed.relations.added.map((r) => r.kind)).toEqual([
      'extends',
      'module_contains_block',
      'exposes',
      'behavior_invokes_behavior',
      'governs',
      'illustrates',
    ]);
    expect<unknown>(parsed.relations.removed).toEqual([
      { kind: 'extends', from: REFUND, to: 'building_block|sales.Legacy' },
      {
        kind: 'behavior_invokes_behavior',
        from: ISSUE,
        to: 'behavior|sales.Old.notify',
      },
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
          {
            kind: 'has_state',
            from: REFUND,
            to: 'primitive|boolean',
            name: 'legacyFlag',
          },
          {
            kind: 'has_input',
            from: ISSUE,
            to: 'primitive|string',
            name: 'note',
          },
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
      {
        kind: 'has_state',
        from: REFUND,
        to: 'primitive|boolean',
        name: 'legacyFlag',
      },
      { kind: 'has_input', from: ISSUE, to: 'primitive|string', name: 'note' },
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

  it('knows a collaborator by its holder and name, so the block it is and how many it holds are fields', () => {
    const LEDGER = 'building_block|sales.ledger.Ledger';
    const parsed = DesignDocument.parse(
      relating({
        added: [
          {
            kind: 'has_collaborator',
            from: REFUND,
            name: 'ledger',
            to: { value: LEDGER },
            cardinality: { value: '1' },
          },
        ],
        removed: [
          {
            kind: 'has_collaborator',
            from: REFUND,
            to: 'building_block|sales.mail.Mailer',
            name: 'mailer',
          },
        ],
        modified: [
          {
            kind: 'has_collaborator',
            from: REFUND,
            name: 'orders',
            to: { value: 'building_block|sales.orders.OrderArchive' },
          },
        ],
      }),
    );

    expect<unknown>(parsed.relations.removed).toEqual([
      {
        kind: 'has_collaborator',
        from: REFUND,
        to: 'building_block|sales.mail.Mailer',
        name: 'mailer',
      },
    ]);
    expect(parsed.relations.modified[0]).toMatchObject({
      name: 'orders',
      to: { changed: true, value: 'building_block|sales.orders.OrderArchive' },
      cardinality: { changed: false },
    });
    expect(
      isValid(
        relating({
          added: [
            {
              kind: 'has_collaborator',
              from: REFUND,
              name: 'ledger',
              to: { value: LEDGER },
              cardinality: { value: 'many' },
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
              kind: 'has_collaborator',
              from: REFUND,
              name: 'clock',
              to: { value: 'primitive|datetime' },
            },
          ],
        }),
      ),
    ).toBe(false);
  });

  it("knows an output by its holder, under the one name 'result', so its type and cardinality are fields; a call by its target, so only the order is", () => {
    const parsed = DesignDocument.parse(
      relating({
        removed: [
          {
            kind: 'has_output',
            from: ISSUE,
            to: 'primitive|boolean',
            name: 'result',
          },
        ],
        modified: [
          {
            kind: 'has_output',
            from: ISSUE,
            name: 'result',
            to: { value: REFUND },
            cardinality: { value: '0..1' },
          },
          {
            kind: 'behavior_invokes_behavior',
            from: ISSUE,
            to: 'behavior|sales.ledger.Ledger.post',
            order: { value: 2 },
          },
        ],
      }),
    );

    expect<unknown>(parsed.relations.removed).toEqual([
      {
        kind: 'has_output',
        from: ISSUE,
        to: 'primitive|boolean',
        name: 'result',
      },
    ]);
    expect<unknown>(parsed.relations.modified.map((r) => r.to)).toEqual([
      { changed: true, value: REFUND, author: 'agent' },
      'behavior|sales.ledger.Ledger.post',
    ]);
    expect(
      isValid(
        relating({
          added: [
            {
              kind: 'has_output',
              from: ISSUE,
              to: { value: REFUND },
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
              name: 'result',
              to: REFUND,
              cardinality: { value: '1' },
            },
          ],
        }),
      ),
    ).toBe(false);
    expect(
      isValid(
        relating({
          removed: [{ kind: 'has_output', from: ISSUE, to: REFUND }],
        }),
      ),
    ).toBe(false);
    expect(
      isValid(
        relating({
          removed: [{ kind: 'has_output', from: ISSUE, name: 'result' }],
        }),
      ),
    ).toBe(false);
    expect(
      isValid(
        relating({
          added: [
            {
              kind: 'behavior_invokes_behavior',
              from: ISSUE,
              to: REFUND,
              order: { value: 1 },
            },
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
    expect(isValid(addingRefund({ type: { value: 'out_adapter' } }))).toBe(
      true,
    );
    // A behavior has no type: what kind of message it handles is not its own.
    expect(isValid(addingIssue({ type: { value: 'Command' } }))).toBe(false);
  });
});

describe('The key a design removes a relation by', () => {
  it('names every relation by its ends, and a named slot of the model by its name too', () => {
    for (const option of DesignedRelationKey.options) {
      const kind = option.shape.kind.value;
      expect([kind, 'to' in option.shape, 'name' in option.shape]).toEqual([
        kind,
        true,
        NAMED_SLOT_KINDS.has(kind),
      ]);
    }
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
              name: 'result',
              to: { value: 'primitive|uuid' },
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
              name: 'result',
              to: { value: 'primitive|money' },
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
                name: 'result',
                to: { value: REFUND },
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
              name: 'result',
              to: { value: REFUND },
              cardinality: { value: 'many' },
            },
          ],
        }),
      ),
    ).toBe(false);
  });
});

describe('Actors and manual processes', () => {
  const CLERK = 'actor|Clerk';
  const REFUND_A_RETURN = 'manual_process|Refund a return';
  const people = (relations: object[]) =>
    design({
      actors: {
        added: [
          {
            id: CLERK,
            name: { value: 'Clerk' },
            definition: { value: 'Serves customers at the counter.' },
          },
        ],
      },
      manualProcesses: {
        added: [
          {
            id: REFUND_A_RETURN,
            name: { value: 'Refund a return' },
            definition: { value: 'The clerk refunds what came back.' },
          },
        ],
      },
      relations: { added: relations },
    });

  it('lets an actor perform a manual process that invokes behaviors in order', () => {
    expect(
      isValid(
        people([
          { kind: 'performs', from: CLERK, to: REFUND_A_RETURN },
          {
            kind: 'process_invokes_behavior',
            from: REFUND_A_RETURN,
            to: ISSUE,
            order: { value: 1 },
          },
        ]),
      ),
    ).toBe(true);
  });

  it('names an actor and a manual process by their name alone', () => {
    expect(
      isValid(
        design({
          actors: {
            added: [
              {
                id: 'actor|sales.Clerk',
                name: { value: 'Clerk' },
                definition: { value: '' },
              },
            ],
          },
        }),
      ),
    ).toBe(false);
  });

  it('lets only an actor perform, and only a manual process', () => {
    expect(
      isValid(people([{ kind: 'performs', from: ISSUE, to: REFUND_A_RETURN }])),
    ).toBe(false);
    expect(
      isValid(people([{ kind: 'performs', from: CLERK, to: ISSUE }])),
    ).toBe(false);
    expect(
      isValid(
        people([
          {
            kind: 'process_invokes_behavior',
            from: CLERK,
            to: ISSUE,
            order: { value: 1 },
          },
        ]),
      ),
    ).toBe(false);
  });

  it('says nothing of who may call a behavior on the behavior', () => {
    expect(
      isValid(
        addingIssue({
          definition: { value: 'Issues a refund.' },
          diagram: { value: '' },
          visibility: { value: { kind: 'public', actors: ['Clerk'] } },
        }),
      ),
    ).toBe(false);
  });

  it('refuses a performs whose actor neither the design nor the model has', () => {
    const violations = DesignDocument.validateAgentGenerated(
      DesignDocument.parse(
        design({
          relations: {
            added: [{ kind: 'performs', from: CLERK, to: REFUND_A_RETURN }],
          },
        }),
      ),
    );
    expect(violations).toContainEqual({
      path: `relations.added[performs|${CLERK}|${REFUND_A_RETURN}].from`,
      reason: 'unknownRelationEnd',
    });
  });
});

describe('Deployable units and libraries', () => {
  const API = 'deployable_unit|refunds-api';
  const SALES = 'library|MyCompany.Sales';
  const REFUNDS = 'module|sales.refunds';
  const packaging = (relations: object[]) =>
    DesignDocument.validateAgentGenerated(
      DesignDocument.parse(
        design({
          modules: {
            added: [
              {
                id: REFUNDS,
                name: { value: 'refunds' },
                definition: { value: 'Refunds.' },
              },
            ],
          },
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
          deployableUnits: {
            added: [
              {
                id: API,
                name: { value: 'refunds-api' },
                definition: { value: 'Issues refunds.' },
              },
            ],
          },
          libraries: {
            added: [
              {
                id: SALES,
                name: { value: 'MyCompany.Sales' },
                definition: { value: 'The sales domain.' },
              },
            ],
          },
          relations: { added: relations },
        }),
      ),
    );

  it('lets a deployable unit contain a module and a library a building block, whatever their paths', () => {
    expect(
      packaging([
        { kind: 'unit_contains_module', from: API, to: REFUNDS },
        { kind: 'library_contains_block', from: SALES, to: REFUND },
      ]),
    ).toEqual([]);
  });

  it('refuses a deployable unit containing a block, or a library a module', () => {
    expect(() =>
      packaging([{ kind: 'unit_contains_module', from: API, to: REFUND }]),
    ).toThrow();
    expect(() =>
      packaging([{ kind: 'library_contains_block', from: SALES, to: REFUNDS }]),
    ).toThrow();
  });

  it("names a unit or a library by the build's name, dots and all, never with a module path", () => {
    const adding = (id: string, name: string) =>
      isValid(
        design({
          libraries: {
            added: [{ id, name: { value: name }, definition: { value: '' } }],
          },
        }),
      );
    expect(adding(SALES, 'MyCompany.Sales')).toBe(true);
    expect(adding('library|a|b', 'a|b')).toBe(false);
    expect(adding('module|sales', 'sales')).toBe(false);
  });
});

describe('Layers and deployment containers', () => {
  const DOMAIN = 'layer|domain';
  const CLUSTER = 'deployment_container|Refunds cluster';
  const API = 'deployable_unit|refunds-api';
  const REFUNDS = 'module|sales.refunds';
  const placing = (relations: object[]) =>
    DesignDocument.validateAgentGenerated(
      DesignDocument.parse(
        design({
          modules: {
            added: [
              {
                id: REFUNDS,
                name: { value: 'refunds' },
                definition: { value: 'Refunds.' },
              },
            ],
          },
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
          deployableUnits: {
            added: [
              {
                id: API,
                name: { value: 'refunds-api' },
                definition: { value: 'Issues refunds.' },
              },
            ],
          },
          layers: {
            added: [
              {
                id: DOMAIN,
                name: { value: 'domain' },
                definition: { value: 'The business rules.' },
              },
            ],
          },
          deploymentContainers: {
            added: [
              {
                id: CLUSTER,
                name: { value: 'Refunds cluster' },
                definition: { value: 'Where refunds run.' },
              },
            ],
          },
          relations: { added: relations },
        }),
      ),
    );

  it('lets a layer contain a building block and a container host a deployable unit', () => {
    expect(
      placing([
        { kind: 'layer_contains_block', from: DOMAIN, to: REFUND },
        { kind: 'container_contains_unit', from: CLUSTER, to: API },
      ]),
    ).toEqual([]);
  });

  it('refuses a layer containing a module', () => {
    expect(() =>
      placing([{ kind: 'layer_contains_block', from: DOMAIN, to: REFUNDS }]),
    ).toThrow();
  });

  it('refuses a container hosting anything but a deployable unit', () => {
    expect(
      isValid(
        design({
          relations: {
            added: [
              { kind: 'container_contains_unit', from: CLUSTER, to: REFUNDS },
            ],
          },
        }),
      ),
    ).toBe(false);
  });

  it('refuses a hosts whose ends neither the design nor the model has', () => {
    expect(
      DesignDocument.validateAgentGenerated(
        DesignDocument.parse(
          design({
            relations: {
              added: [
                { kind: 'container_contains_unit', from: CLUSTER, to: API },
              ],
            },
          }),
        ),
      ).map((violation) => violation.reason),
    ).toEqual(['unknownRelationEnd', 'unknownRelationEnd']);
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
   * What the scanner found: the orders module; its Order, which extends
   * Auditable and has a total; and Order.cancel, which takes an order,
   * returns a boolean and follows a rule with one scenario.
   */
  const scanned = SystemModel.parse({
    id: '01a0d22d-7f47-76b9-abd4-bd21d66a1d17',
    name: 'shop',
    scanned_at: '2026-09-25T08:00:00.000Z',
    modules: [{ id: ORDERS, name: 'orders', source }],
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
      { kind: 'governs', from: CANCEL, to: PAID_ONLY },
      { kind: 'illustrates', from: CANCELLING_PAID, to: PAID_ONLY },
    ],
    buildingBlocks: [{ id: ORDER, name: 'Order', type: 'aggregate', source }],
    rules: [
      {
        id: PAID_ONLY,
        name: 'Paid orders only',
        kind: 'state_change',
        source,
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
        source,
      },
    ],
    behaviors: [
      {
        id: CANCEL,
        name: 'cancel',
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
              {
                kind: 'has_state',
                from: ORDER,
                to: 'primitive|boolean',
                name: 'legacyFlag',
              },
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
                  kind: 'behavior_invokes_behavior',
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
          path: `relations.added[behavior_invokes_behavior|${ISSUE}|${CANCEL}].from`,
          reason: 'unknownRelationEnd',
        },
        {
          path: `relations.added[behavior_invokes_behavior|${ISSUE}|${CANCEL}].to`,
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
                { kind: 'has_input', from: CANCEL, to: ORDER, name: 'order' },
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
                  name: 'result',
                  to: { value: 'primitive|boolean' },
                  cardinality: { value: '0..1' },
                },
              ],
            },
            buildingBlocks: { modified: [{ id: ORDER }] },
            behaviors: { modified: [{ id: CANCEL }] },
            rules: {
              modified: [{ id: PAID_ONLY, kind: { value: 'validation' } }],
            },
            scenarios: { removed: [CANCELLING_PAID] },
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
                {
                  kind: 'has_state',
                  from: ORDER,
                  to: 'primitive|boolean',
                  name: 'legacyFlag',
                },
                {
                  kind: 'has_input',
                  from: CANCEL,
                  to: 'building_block|sales.orders.Orders',
                  name: 'orders',
                },
                {
                  kind: 'has_output',
                  from: 'behavior|sales.orders.Order.ship',
                  to: ORDER,
                  name: 'result',
                },
              ],
              modified: [{ kind: 'has_state', from: ORDER, name: 'discount' }],
            },
            rules: { removed: ['rule|sales.orders.Open orders only'] },
            scenarios: {
              modified: [
                { id: `scenario|sales.orders.Paid orders only.Shipped` },
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
          path: 'scenarios.modified[scenario|sales.orders.Paid orders only.Shipped]',
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
          path: 'relations.removed[has_output|behavior|sales.orders.Order.ship|#result]',
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
                  kind: 'behavior_invokes_behavior',
                  from: CANCEL,
                  to: ISSUE,
                  order: { value: 1 },
                },
                { kind: 'exposes', from: REFUND, to: ISSUE },
                { kind: 'module_contains_block', from: ORDERS, to: REFUND },
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
                    definition: { value: 'Issues it.' },
                  },
                ],
              },
            },
          ),
          scanned,
        ),
      ).toEqual([
        {
          path: `relations.added[module_contains_block|${ORDERS}|${REFUND}]`,
          reason: 'containmentOutsideIdPath',
        },
        {
          path: `relations.added[exposes|${ORDER}|${ISSUE}]`,
          reason: 'containmentOutsideIdPath',
        },
      ]);
    });

    it('holds a value of the domain or a primitive as state, any other block as a collaborator', () => {
      const LEDGER = 'building_block|sales.orders.Ledger';
      expect(
        validate(
          relating(
            {
              added: [
                {
                  kind: 'has_state',
                  from: ORDER,
                  name: 'ledger',
                  to: { value: LEDGER },
                  cardinality: { value: '1' },
                },
                {
                  kind: 'has_collaborator',
                  from: ORDER,
                  name: 'auditable',
                  to: { value: AUDITABLE },
                  cardinality: { value: '1' },
                },
                {
                  kind: 'has_state',
                  from: ORDER,
                  name: 'note',
                  to: { value: 'primitive|string' },
                  cardinality: { value: '0..1' },
                },
                {
                  kind: 'has_collaborator',
                  from: ORDER,
                  name: 'archive',
                  to: { value: 'building_block|sales.orders.Archive' },
                  cardinality: { value: '1' },
                },
              ],
            },
            {
              buildingBlocks: {
                added: [
                  {
                    id: LEDGER,
                    name: { value: 'Ledger' },
                    type: { value: 'out_adapter' },
                    definition: { value: 'Where money is booked.' },
                  },
                  {
                    id: 'building_block|sales.orders.Archive',
                    name: { value: 'Archive' },
                    type: { value: 'repository' },
                    definition: { value: 'Where old orders go.' },
                  },
                ],
              },
            },
          ),
          SystemModel.parse({
            ...scanned,
            buildingBlocks: [
              ...scanned.buildingBlocks,
              {
                id: AUDITABLE,
                name: 'Auditable',
                type: 'value_object',
                source,
              },
            ],
          }),
        ),
      ).toEqual([
        {
          path: `relations.added[has_state|${ORDER}|#ledger].kind`,
          reason: 'slotOutsideTypeKind',
        },
        {
          path: `relations.added[has_collaborator|${ORDER}|#auditable].kind`,
          reason: 'slotOutsideTypeKind',
        },
      ]);
    });

    it('reports an element the model does not have once, not each part changed under it', () => {
      const missing = 'building_block|sales.orders.OrderLine';

      expect(
        validate(
          design({
            buildingBlocks: {
              modified: [{ id: missing, name: { value: 'Line' } }],
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
            definition: { value: 'Issues a refund.' },
          }),
        ),
      ).toEqual([]);
    });

    it('draws a diagram in its own field, never in a fence of the definition', () => {
      const fenced = 'Issues a refund.\n\n```mermaid\nsequenceDiagram\n```';

      expect(
        validate(
          addingIssue({
            definition: { value: fenced },
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
              definition: { value: fenced },
            }),
          ),
        ),
      ).toEqual([]);
      expect(
        validate(
          addingIssue({
            definition: { value: 'Issues a refund.' },
            diagram: { value: 'sequenceDiagram\n  A->>B: issue' },
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

describe('The steps of a scenario', () => {
  it('may repeat a kind or leave one out, but are never none', () => {
    const scenario = (steps: unknown[]) =>
      isValid(
        design({
          scenarios: {
            added: [
              {
                id: 'scenario|sales.Refunds are bounded.Refunding a line',
                steps: { value: steps },
              },
            ],
          },
        }),
      );
    expect(
      scenario([
        { kind: 'given', text: 'a paid order' },
        { kind: 'given', text: 'a voucher' },
        { kind: 'then', text: 'the voucher is void' },
      ]),
    ).toBe(true);
    expect(scenario([{ kind: 'then', text: 'nothing happens' }])).toBe(true);
    expect(scenario([])).toBe(false);
    expect(scenario([{ kind: 'and', text: 'a voucher' }])).toBe(false);
  });
});

describe('A rule of a design', () => {
  const ORDERS = 'module|sales.orders';
  const CANCEL = 'behavior|sales.orders.Order.cancel';
  const PAID_ONLY = 'rule|sales.orders.Paid orders only';
  const source = { path: 'features/orders.feature', line: 3 };
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
    behaviors: [{ id: CANCEL, name: 'cancel', source }],
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
