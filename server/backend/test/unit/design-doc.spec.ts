import { describe, expect, it } from 'bun:test';
import { z } from 'zod';
import { DesignDocument } from '#backend/app/design-docs/design-doc';
import { BehaviorId, BuildingBlockId, ModuleId } from '#backend/app/element-id';
import { designDocFixture } from '../fixtures/design-doc.fixture';

const document = {
  id: 'doc-1',
  name: { value: 'Refunds' },
  description: {
    value: 'Let a clerk refund an order.',
    status: 'acceptedByHuman',
  },
  modules: {
    added: [{ id: 'module|sales.refunds' }],
  },
  buildingBlocks: {
    added: [
      {
        id: 'building_block|sales.refunds.Refund',
        type: { value: 'aggregate' },
        implements: ['building_block|sales.orders.Payable'],
        properties: { added: [{ name: { value: 'amount' } }] },
      },
    ],
    modified: [
      {
        id: 'building_block|sales.orders.Order',
        properties: { removed: ['legacyFlag'] },
      },
    ],
    removed: ['building_block|sales.orders.OrderLegacy'],
  },
  behaviours: {
    added: [
      {
        id: 'behavior|sales.refunds.Refund.issue',
        type: { value: 'Command' },
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

  it('fills absent change sets, lists and design doc fields', () => {
    const parsed = DesignDocument.parse({
      id: 'doc-2',
      name: { value: 'Empty' },
      description: { value: '' },
    });

    expect(parsed.modules).toEqual({ added: [], removed: [], modified: [] });
    expect(parsed.buildingBlocks.modified).toEqual([]);
    expect(parsed.behaviours.removed).toEqual([]);
    expect(parsed.name.status).toBe('setByAgent');
    expect(parsed.implemented).toBe(false);

    const block = DesignDocument.parse(document).buildingBlocks.added[0]!;
    expect(block.description).toEqual({ value: null, status: 'setByAgent' });
    expect(block.properties?.removed).toEqual([]);
  });

  it('rejects an id of the wrong kind', () => {
    const result = DesignDocument.safeParse({
      ...document,
      modules: { added: [{ id: 'building_block|sales.refunds' }] },
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
  const existing = DesignDocument.parse({
    id: 'doc-1',
    name: { value: 'Refunds', status: 'setByHuman' },
    description: { value: 'Let a clerk refund an order.' },
    buildingBlocks: {
      added: [
        {
          id: 'building_block|sales.refunds.Refund',
          description: { value: 'Money back.', status: 'setByHuman' },
          properties: {
            added: [{ name: { value: 'amount', status: 'acceptedByHuman' } }],
          },
        },
      ],
    },
  });

  const agentVersion = (patch: {
    nameStatus?: string;
    blockDescriptionStatus?: string;
    descriptionStatus?: string;
  }) =>
    DesignDocument.parse({
      id: 'doc-1',
      name: { value: 'Refunds', status: patch.nameStatus ?? 'acceptedByHuman' },
      description: {
        value: 'Let support refund an order.',
        status: patch.descriptionStatus ?? 'setByAgent',
      },
      buildingBlocks: {
        added: [
          {
            id: 'building_block|sales.refunds.Refund',
            description: {
              value: 'Money back.',
              status: patch.blockDescriptionStatus ?? 'acceptedByHuman',
            },
            properties: { added: [{ name: { value: 'amount' } }] },
          },
        ],
      },
    });

  it('passes when every value a human set comes back accepted', () => {
    expect(
      DesignDocument.validateAgentVersion(existing, agentVersion({})),
    ).toEqual([]);
  });

  it('reports a value a human set that does not come back accepted', () => {
    expect(
      DesignDocument.validateAgentVersion(
        existing,
        agentVersion({ blockDescriptionStatus: 'setByAgent' }),
      ),
    ).toEqual([
      {
        path: 'buildingBlocks.added[building_block|sales.refunds.Refund].description',
        reason: 'humanValueNotAccepted',
      },
    ]);
  });

  it('reports a value a human set that the agent left out', () => {
    const dropped = DesignDocument.parse({
      ...agentVersion({}),
      buildingBlocks: {},
    });

    expect(DesignDocument.validateAgentVersion(existing, dropped)).toEqual([
      {
        path: 'buildingBlocks.added[building_block|sales.refunds.Refund].description',
        reason: 'humanValueNotAccepted',
      },
    ]);
  });

  it('reports a field the agent claims a human set', () => {
    expect(
      DesignDocument.validateAgentVersion(
        existing,
        agentVersion({ descriptionStatus: 'setByHuman' }),
      ),
    ).toEqual([{ path: 'description', reason: 'setByHumanClaimedByAgent' }]);
  });

  it('lets the agent change a value a human only accepted', () => {
    const version = agentVersion({});
    const renamed = DesignDocument.parse({
      ...version,
      buildingBlocks: {
        added: [
          {
            ...version.buildingBlocks.added[0],
            properties: { added: [{ name: { value: 'total' } }] },
          },
        ],
      },
    });

    expect(DesignDocument.validateAgentVersion(existing, renamed)).toEqual([]);
  });
});
