import { describe, expect, it } from 'bun:test';
import { z } from 'zod';
import { DesignDocumentSchema } from '#backend/app/design-docs/design-doc';
import { BehaviorId, BuildingBlockId, ModuleId } from '#backend/app/element-id';
import { designDocFixture } from '../fixtures/design-doc.fixture';

const document = {
  id: '2026-01-01-doc-1',
  name: { value: 'Refunds' },
  description: { value: 'Let a clerk refund an order.', reviewedByHuman: true },
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

describe('DesignDocumentSchema', () => {
  it('keeps every element id as the string it was written as', () => {
    const parsed = DesignDocumentSchema.parse(document);

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
    const parsed = DesignDocumentSchema.parse(document);
    const module = parsed.modules.added[0]!.id;
    const block = parsed.buildingBlocks.added[0]!.id;
    const behaviour = parsed.behaviours.added[0]!.id;

    expect(ModuleId.parentOf(module)).toBe(ModuleId.root('sales'));
    expect(ModuleId.containing(block)).toBe(module);
    expect(BuildingBlockId.containing(behaviour)).toBe(block);
  });

  it('fills absent change sets, lists and reviewable fields', () => {
    const parsed = DesignDocumentSchema.parse({
      id: '2026-01-01-doc-2',
      name: { value: 'Empty' },
      description: { value: '' },
    });

    expect(parsed.modules).toEqual({ added: [], removed: [], modified: [] });
    expect(parsed.buildingBlocks.modified).toEqual([]);
    expect(parsed.behaviours.removed).toEqual([]);
    expect(parsed.name.reviewedByHuman).toBe(false);
    expect(parsed.implemented).toBe(false);

    const block = DesignDocumentSchema.parse(document).buildingBlocks.added[0]!;
    expect(block.description).toEqual({ value: null, reviewedByHuman: false });
    expect(block.properties?.removed).toEqual([]);
  });

  it('rejects an id of the wrong kind', () => {
    const result = DesignDocumentSchema.safeParse({
      ...document,
      modules: { added: [{ id: 'building_block|sales.refunds' }] },
    });

    expect(result.success).toBe(false);
  });

  it('encodes the fixture back to exactly what it was written as', () => {
    const parsed = DesignDocumentSchema.parse(designDocFixture);
    expect(z.encode(DesignDocumentSchema, parsed)).toEqual(designDocFixture);
  });

  it('encodes back to the wire form', () => {
    const parsed = DesignDocumentSchema.parse(document);
    const wire = z.encode(DesignDocumentSchema, parsed);

    expect(wire.modules?.added?.[0]?.id).toBe('module|sales.refunds');
    expect(wire.behaviours?.added?.[0]?.id).toBe(
      'behavior|sales.refunds.Refund.issue',
    );
    expect(wire.buildingBlocks?.removed).toEqual([
      'building_block|sales.orders.OrderLegacy',
    ]);
  });
});
