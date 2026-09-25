import { describe, expect, it } from 'bun:test';
import { z } from 'zod';
import { DesignDocument } from '#backend/app/design-docs/design-doc';
import {
  agentDesignDocFixture,
  designDocFixture,
} from '../fixtures/design-doc.fixture';

/*
 * A design document is a diff against the scanned model: the modules,
 * building blocks and behaviours a change adds, modifies or removes. An agent
 * writes it; a human reviews it, and a field a human wrote is theirs.
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

  it('adds and removes an implemented interface or a used building block by its id', () => {
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
        behaviours: {
          modified: [
            {
              id: ISSUE,
              usedBuildingBlocks: {
                added: ['building_block|sales.orders.Order'],
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
    expect<string[] | undefined>(
      parsed.behaviours.modified[0]?.usedBuildingBlocks.added,
    ).toEqual(['building_block|sales.orders.Order']);
  });

  it('never modifies an implemented interface, an input, an output or a used building block: it removes one and adds another', () => {
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
    expect(isValid(modifying('usedBuildingBlocks'))).toBe(false);
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

describe('What an agent may write', () => {
  const MODULE_DESCRIPTION =
    'modules.modified[module|sales.refunds].description';
  const BLOCK_DESCRIPTION = `buildingBlocks.modified[${REFUND}].description`;

  /*
   * A stored design whose building block description a human wrote. Every
   * element is modified, not added, so only the rules on human fields apply.
   */
  const version = (patch: {
    moduleDescription?: object;
    blockDescription?: object;
    propertyName?: string;
  }) =>
    DesignDocument.parse(
      design({
        modules: {
          modified: [
            {
              id: 'module|sales.refunds',
              description: patch.moduleDescription ?? { value: 'Refunds.' },
            },
          ],
        },
        buildingBlocks: {
          modified: [
            {
              id: REFUND,
              description: patch.blockDescription ?? {
                value: 'Money back.',
                author: 'human',
              },
              properties: {
                modified: [{ name: patch.propertyName ?? 'amount' }],
              },
            },
          ],
        },
      }),
    );
  const stored = version({});

  describe('in a new design document', () => {
    it('writes every changed field as the agent', () => {
      expect(
        DesignDocument.violationsOf(
          DesignDocument.parse(agentDesignDocFixture),
        ),
      ).toEqual([]);
    });

    it('never claims a human wrote a field', () => {
      expect(DesignDocument.violationsOf(stored)).toEqual([
        { path: BLOCK_DESCRIPTION, reason: 'humanAuthorClaimed' },
      ]);
    });

    it('gives every field of an added element a value, at any depth', () => {
      const parsed = DesignDocument.parse(
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
                id: 'building_block|sales.orders.Order',
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
      );

      expect(DesignDocument.violationsOf(parsed)).toEqual([
        {
          path: `buildingBlocks.added[${REFUND}].name`,
          reason: 'unchangedFieldInAddedItem',
        },
        {
          path: 'buildingBlocks.modified[building_block|sales.orders.Order].properties.added[refundedAmount].description',
          reason: 'unchangedFieldInAddedItem',
        },
      ]);
    });

    it('leaves a field of a modified element unchanged', () => {
      const parsed = DesignDocument.parse(
        design({ buildingBlocks: { modified: [{ id: REFUND }] } }),
      );

      expect(DesignDocument.violationsOf(parsed)).toEqual([]);
    });

    it('is told every rule it broke at once', () => {
      const parsed = DesignDocument.parse(
        addingRefund({
          type: { value: 'aggregate', author: 'human' },
        }),
      );

      expect(DesignDocument.violationsOf(parsed)).toEqual([
        {
          path: `buildingBlocks.added[${REFUND}].description`,
          reason: 'unchangedFieldInAddedItem',
        },
        {
          path: `buildingBlocks.added[${REFUND}].type`,
          reason: 'humanAuthorClaimed',
        },
      ]);
    });
  });

  describe('in a new version of a stored design document', () => {
    it('writes back what a human wrote exactly as it is', () => {
      const fixture = DesignDocument.parse(designDocFixture);

      expect(DesignDocument.violationsOf(fixture, fixture)).toEqual([]);
      expect(DesignDocument.violationsOf(version({}), stored)).toEqual([]);
    });

    it('rewrites freely what an agent wrote', () => {
      expect(
        DesignDocument.violationsOf(
          version({
            moduleDescription: { value: 'Giving money back.' },
            propertyName: 'total',
          }),
          stored,
        ),
      ).toEqual([]);
    });

    it('never changes a value a human wrote', () => {
      expect(
        DesignDocument.violationsOf(
          version({ blockDescription: { value: 'Refund.', author: 'human' } }),
          stored,
        ),
      ).toEqual([{ path: BLOCK_DESCRIPTION, reason: 'humanValueChanged' }]);
    });

    it('never takes over a field a human wrote, even keeping its value', () => {
      expect(
        DesignDocument.violationsOf(
          version({ blockDescription: { value: 'Money back.' } }),
          stored,
        ),
      ).toEqual([{ path: BLOCK_DESCRIPTION, reason: 'humanValueChanged' }]);
    });

    it('never drops a field a human wrote', () => {
      const dropped = DesignDocument.parse({
        ...version({}),
        buildingBlocks: {},
      });

      expect(DesignDocument.violationsOf(dropped, stored)).toEqual([
        { path: BLOCK_DESCRIPTION, reason: 'humanValueChanged' },
      ]);
    });

    it('never claims a human wrote a field a human did not', () => {
      expect(
        DesignDocument.violationsOf(
          version({
            moduleDescription: { value: 'Refunds.', author: 'human' },
          }),
          stored,
        ),
      ).toEqual([{ path: MODULE_DESCRIPTION, reason: 'humanAuthorClaimed' }]);
    });
  });
});
