import { describe, expect, it } from 'bun:test';
import { outlineOf } from '../src/features/design-docs/design-doc-outline';
import type { OutlineNode } from '../src/shared/ui/model-tree/model-outline';
import { changedEverywhereFixture } from './fixtures/design-doc-outline.fixture';

const outline = outlineOf(changedEverywhereFixture);
const byPath = new Map(outline.map((node) => [node.path, node]));
const at = (path: string): OutlineNode => {
  const node = byPath.get(path);
  if (node === undefined) throw new Error(`No node at ${path}`);
  return node;
};
const childrenOf = (path: string | null) =>
  outline.filter((node) => node.parentPath === path).map((node) => node.name);

describe('outlineOf', () => {
  it('gives every node a parent that is in the outline', () => {
    for (const node of outline) {
      if (node.parentPath !== null)
        expect(byPath.has(node.parentPath)).toBe(true);
    }
  });

  it('roots the tree at the module no change set mentions', () => {
    const roots = outline.filter((node) => node.parentPath === null);
    expect(roots.map((node) => node.path)).toEqual(['module|sales']);
    expect(roots[0]?.change).toBe('unchanged');
    expect(roots[0]?.depth).toBe(0);
  });

  it('carries what the design does to an element it names', () => {
    expect(at('module|sales.refunds').change).toBe('added');
    expect(at('module|sales.orders').change).toBe('modified');
    expect(at('module|sales.credit-notes').change).toBe('removed');
  });

  it('makes a node of an element the design only removes', () => {
    const removed = at('building_block|sales.credit-notes.CreditNote');
    expect(removed).toMatchObject({
      kind: 'building_block',
      name: 'CreditNote',
      change: 'removed',
      pattern: null,
      parentPath: 'module|sales.credit-notes',
    });
  });

  it('hangs a behaviour under its building block, and that under its module', () => {
    expect(at('behavior|sales.refunds.Refund.issue')).toMatchObject({
      kind: 'behaviour',
      name: 'issue',
      pattern: 'Command',
      patternLabel: 'Command',
      parentPath: 'building_block|sales.refunds.Refund',
      depth: 3,
    });
    expect(at('building_block|sales.refunds.Refund').parentPath).toBe(
      'module|sales.refunds',
    );
  });

  it('comes out in pre-order, each node one deeper than its parent', () => {
    const seen = new Set<string | null>([null]);
    for (const node of outline) {
      expect(seen.has(node.parentPath)).toBe(true);
      seen.add(node.path);
      const parent = node.parentPath === null ? null : at(node.parentPath);
      expect(node.depth).toBe(parent === null ? 0 : parent.depth + 1);
    }
  });

  it('puts submodules above the blocks of their parent', () => {
    expect(childrenOf('module|sales')).toEqual([
      'credit-notes',
      'orders',
      'refunds',
    ]);
  });

  it('orders building blocks as a reader meets them, not alphabetically', () => {
    expect(childrenOf('module|sales.refunds')).toEqual([
      'RefundRepository',
      'Refund',
      'RefundIssued',
    ]);
  });

  it('puts rules and scenarios last inside a building block', () => {
    expect(childrenOf('building_block|sales.refunds.Refund')).toEqual([
      'issue',
      'issuedAt',
      'lines',
      'orderId',
      'Refund never exceeds paid amount',
      'Refunding one line of a paid order',
    ]);
  });

  it('names a property type by its item, a collection with brackets', () => {
    expect(
      at('building_block|sales.refunds.Refund#property:lines').pattern,
    ).toBe('RefundLine[]');
    expect(
      at('building_block|sales.refunds.Refund#property:issuedAt').pattern,
    ).toBe('date');
  });

  it('keys a part under the element that owns it', () => {
    expect(
      at('building_block|sales.refunds.Refund#property:orderId'),
    ).toMatchObject({
      kind: 'property',
      name: 'orderId',
      change: 'added',
      elementId: null,
      pattern: 'OrderId',
      parentPath: 'building_block|sales.refunds.Refund',
    });
    expect(
      at('building_block|sales.orders.Order#property:creditNoteId').change,
    ).toBe('removed');
    expect(
      at(
        'behavior|sales.refunds.Refund.issue#rule:Only paid orders are refundable',
      ).pattern,
    ).toBe('State change');
  });

  it('names an element by its own name, never by its address', () => {
    expect(at('building_block|sales.refunds.Refund').name).toBe('Refund');
    expect(at('module|sales.refunds').name).toBe('refunds');
  });

  it('marks the one element whose description draws a diagram', () => {
    expect(
      outline.filter((node) => node.hasDiagram).map((node) => node.path),
    ).toEqual(['behavior|sales.refunds.Refund.issue']);
  });

  it('says nothing about a document that designs nothing', () => {
    expect(
      outlineOf({
        id: '2026-01-01-empty',
        name: 'Empty',
        description: '',
      }),
    ).toEqual([]);
  });
});
