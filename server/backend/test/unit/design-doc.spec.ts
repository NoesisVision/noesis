import { describe, expect, it } from 'bun:test';
import { z } from 'zod';
import { DesignDocument } from '#backend/app/design-docs/design-doc';
import { BehaviorId, BuildingBlockId, ModuleId } from '#backend/app/element-id';
import { designDocFixture } from '../fixtures/design-doc.fixture';

const document = {
  id: 'doc-1',
  name: 'Refunds',
  description: 'Let a clerk refund an order.',
  modules: {
    added: [{ id: 'module|sales.refunds', name: { value: 'refunds' } }],
  },
  buildingBlocks: {
    added: [
      {
        id: 'building_block|sales.refunds.Refund',
        name: { value: 'Refund' },
        type: { value: 'aggregate' },
        implements: { added: ['building_block|sales.orders.Payable'] },
        properties: {
          added: [
            {
              name: 'lines',
              type: {
                value: {
                  collectionOf: { collectionOf: { primitive: 'string' } },
                },
              },
            },
          ],
        },
      },
    ],
    modified: [
      {
        id: 'building_block|sales.orders.Order',
        name: { value: 'Order' },
        properties: { removed: ['legacyFlag'] },
      },
    ],
    removed: ['building_block|sales.orders.OrderLegacy'],
  },
  behaviours: {
    added: [
      {
        id: 'behavior|sales.refunds.Refund.issue',
        name: { value: 'issue' },
        type: { value: 'Command' },
        visibility: { value: { kind: 'public', actors: ['Clerk'] } },
        input: { added: ['building_block|sales.orders.Order'] },
        usedBuildingBlocks: { added: ['building_block|sales.orders.Order'] },
      },
    ],
  },
};

describe('DesignDocument schema', () => {
  it('keeps every element id as the string it was written as', () => {
    const parsed = DesignDocument.parse(document);

    expect(parsed.modules.added[0]?.id).toBe(
      ModuleId.parse('module|sales.refunds'),
    );
    expect(parsed.buildingBlocks.removed[0]).toBe(
      BuildingBlockId.parse('building_block|sales.orders.OrderLegacy'),
    );
    expect(parsed.behaviours.added[0]?.id).toBe(
      BehaviorId.parse('behavior|sales.refunds.Refund.issue'),
    );
  });

  it('names each element’s parent through its id', () => {
    const parsed = DesignDocument.parse(document);
    const module = parsed.modules.added[0]!.id;
    const block = parsed.buildingBlocks.added[0]!.id;
    const behaviour = parsed.behaviours.added[0]!.id;

    expect(ModuleId.parentOf(module)).toBe(ModuleId.root('sales'));
    expect(ModuleId.containing(block)).toBe(module);
    expect(BuildingBlockId.containing(behaviour)).toBe(block);
  });

  it('reads an absent field as unchanged and an absent change set as empty', () => {
    const parsed = DesignDocument.parse(document);

    expect(parsed.modules.added[0]?.name).toEqual({
      changed: true,
      value: 'refunds',
      author: 'agent',
    });
    expect(parsed.implemented).toBe(false);

    const block = parsed.buildingBlocks.added[0]!;
    expect(block.description).toEqual({ changed: false, author: 'agent' });
    expect(block.rules).toEqual({ added: [], removed: [], modified: [] });
    expect(parsed.behaviours.removed).toEqual([]);
  });

  it('rejects a primitive it does not know', () => {
    const result = DesignDocument.safeParse({
      ...document,
      behaviours: {
        added: [
          {
            id: 'behavior|sales.refunds.Refund.issue',
            name: { value: 'issue' },
            input: { added: [{ collectionOf: { primitive: 'money' } }] },
          },
        ],
      },
    });

    expect(result.success).toBe(false);
  });

  it('requires the document name', () => {
    expect(
      DesignDocument.safeParse({ ...document, name: undefined }).success,
    ).toBe(false);
  });

  it('rejects a value on an unchanged field', () => {
    const result = DesignDocument.safeParse({
      ...document,
      modules: {
        added: [
          {
            id: 'module|sales.refunds',
            name: { value: 'refunds' },
            description: { changed: false, value: 'Money back.' },
          },
        ],
      },
    });

    expect(result.success).toBe(false);
  });

  it('rejects an actor on a private behaviour', () => {
    const result = DesignDocument.safeParse({
      ...document,
      behaviours: {
        added: [
          {
            id: 'behavior|sales.refunds.Refund.issue',
            name: { value: 'issue' },
            visibility: { value: { kind: 'private', actors: ['Clerk'] } },
          },
        ],
      },
    });

    expect(result.success).toBe(false);
  });

  it('rejects an id of the wrong kind', () => {
    const result = DesignDocument.safeParse({
      ...document,
      modules: {
        added: [{ id: 'building_block|sales.refunds', name: { value: 'x' } }],
      },
    });

    expect(result.success).toBe(false);
  });

  it('encodes the fixture back to exactly what it was written as', () => {
    const parsed = DesignDocument.parse(designDocFixture);
    expect(z.encode(DesignDocument, parsed)).toEqual(designDocFixture);
  });

  it('encodes back to the wire form', () => {
    const parsed = DesignDocument.parse(document);
    const wire = z.encode(DesignDocument, parsed);

    expect(wire.modules?.added?.[0]?.id).toBe('module|sales.refunds');
    expect(wire.behaviours?.added?.[0]?.id).toBe(
      'behavior|sales.refunds.Refund.issue',
    );
    expect(wire.buildingBlocks?.removed).toEqual([
      'building_block|sales.orders.OrderLegacy',
    ]);
  });
});

describe('DesignDocument.validateAgentVersion', () => {
  const block = 'building_block|sales.refunds.Refund';
  const blockDescription = `buildingBlocks.added[${block}].description`;

  const version = (patch: {
    blockDescription?: object;
    description?: object;
    propertyName?: string;
  }) =>
    DesignDocument.parse({
      id: 'doc-1',
      name: 'Refunds',
      description: 'Let a clerk refund.',
      modules: {
        added: [
          {
            id: 'module|sales.refunds',
            name: { value: 'refunds' },
            description: patch.description ?? { value: 'Refunds.' },
          },
        ],
      },
      buildingBlocks: {
        added: [
          {
            id: block,
            name: { value: 'Refund' },
            description: patch.blockDescription ?? {
              value: 'Money back.',
              author: 'human',
            },
            properties: {
              added: [{ name: patch.propertyName ?? 'amount' }],
            },
          },
        ],
      },
    });

  const existing = version({});

  it('passes when every field a human wrote comes back unchanged', () => {
    expect(DesignDocument.validateAgentVersion(existing, version({}))).toEqual(
      [],
    );
  });

  it('reports a value a human wrote that the agent changed', () => {
    expect(
      DesignDocument.validateAgentVersion(
        existing,
        version({ blockDescription: { value: 'Refund.', author: 'human' } }),
      ),
    ).toEqual([{ path: blockDescription, reason: 'humanValueChanged' }]);
  });

  it('reports a field a human wrote that the agent took over', () => {
    expect(
      DesignDocument.validateAgentVersion(
        existing,
        version({ blockDescription: { value: 'Money back.' } }),
      ),
    ).toEqual([{ path: blockDescription, reason: 'humanValueChanged' }]);
  });

  it('reports a field a human wrote that the agent left out', () => {
    const dropped = DesignDocument.parse({
      ...version({}),
      buildingBlocks: {},
    });

    expect(DesignDocument.validateAgentVersion(existing, dropped)).toEqual([
      { path: blockDescription, reason: 'humanValueChanged' },
    ]);
  });

  it('reports a field the agent claims a human wrote', () => {
    expect(
      DesignDocument.validateAgentVersion(
        existing,
        version({ description: { value: 'Refunds.', author: 'human' } }),
      ),
    ).toEqual([
      {
        path: 'modules.added[module|sales.refunds].description',
        reason: 'humanAuthorClaimed',
      },
    ]);
  });

  it('lets the agent change what an agent wrote', () => {
    expect(
      DesignDocument.validateAgentVersion(
        existing,
        version({ propertyName: 'total' }),
      ),
    ).toEqual([]);
  });
});

describe('DesignDocument.validateAddedItems', () => {
  it('passes the fixture', () => {
    expect(
      DesignDocument.validateAddedItems(DesignDocument.parse(designDocFixture)),
    ).toEqual([]);
  });

  it('reports an unchanged field of an added item, at any depth', () => {
    const parsed = DesignDocument.parse({
      id: 'doc-1',
      name: 'Refunds',
      description: 'Let a clerk refund an order.',
      buildingBlocks: {
        added: [
          {
            id: 'building_block|sales.refunds.Refund',
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
                  type: { value: { primitive: 'decimal' } },
                  optional: { value: false },
                },
              ],
            },
          },
        ],
      },
    });

    expect(DesignDocument.validateAddedItems(parsed)).toEqual([
      {
        path: 'buildingBlocks.added[building_block|sales.refunds.Refund].name',
        reason: 'unchangedFieldInAddedItem',
      },
      {
        path: 'buildingBlocks.modified[building_block|sales.orders.Order].properties.added[refundedAmount].description',
        reason: 'unchangedFieldInAddedItem',
      },
    ]);
  });
});
