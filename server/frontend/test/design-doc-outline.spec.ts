import { describe, expect, it } from 'bun:test';
import {
  outlineOf,
  ownerOfPart,
  partKeyOf,
} from '../src/features/design-docs/design-doc-outline';
import type { OutlineNode } from '../src/features/design-docs/ui/model-tree/model-outline';
import {
  changedEverywhereFixture,
  MORE_THAN_PAID,
  NOT_EXCEEDING,
  PAID_ONLY,
  WITHIN_A_SECOND,
  WITHOUT_RECEIPT,
} from './fixtures/design-doc-outline.fixture';

const ISSUE = 'behavior|sales.refunds.Refund.issue';

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

  it('hangs a behavior under its building block, and that under its module', () => {
    expect(at('behavior|sales.refunds.Refund.issue')).toMatchObject({
      kind: 'behavior',
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
      'A refund is issued within a second',
    ]);
  });

  it('hangs a rule the design names no behavior of under its module, after its building blocks', () => {
    expect(at(`module|sales.refunds#rule:${WITHIN_A_SECOND}`)).toMatchObject({
      kind: 'rule',
      name: 'A refund is issued within a second',
      change: 'modified',
      elementId: null,
      pattern: 'configuration',
      parentPath: 'module|sales.refunds',
    });
  });

  it('hangs a rule under the behavior that governs it, never under a building block', () => {
    expect(childrenOf('building_block|sales.refunds.Refund')).toEqual([
      'issue',
      'issuedAt',
      'lines',
      'orderId',
    ]);
    expect(childrenOf(ISSUE)).toEqual([
      'Only paid orders are refundable',
      'Refund never exceeds paid amount',
    ]);
  });

  it('hangs a rule under each behavior that governs it', () => {
    const outline = outlineOf({
      ...changedEverywhereFixture,
      relations: {
        added: [
          { kind: 'governs', from: ISSUE, to: PAID_ONLY },
          {
            kind: 'governs',
            from: 'behavior|sales.orders.Order.cancel',
            to: PAID_ONLY,
          },
        ],
      },
    });
    expect(
      outline
        .filter((node) => node.name === 'Only paid orders are refundable')
        .map((node) => node.parentPath),
    ).toEqual(['behavior|sales.orders.Order.cancel', ISSUE]);
  });

  it('names a property by its type and how many it holds, nothing for exactly one', () => {
    expect(
      at('building_block|sales.refunds.Refund#property:lines').pattern,
    ).toBe('RefundLine [*]');
    expect(
      at('building_block|sales.orders.Order#property:refundedAmount').pattern,
    ).toBe('Money [0..1]');
    expect(
      at('building_block|sales.refunds.Refund#property:issuedAt').pattern,
    ).toBe('date');
  });

  it('reads a property from the relations, with what the design does to it', () => {
    const order = 'building_block|sales.orders.Order';
    expect(at(`${order}#property:status`)).toMatchObject({
      change: 'modified',
      pattern: 'OrderStatus',
      parentPath: order,
    });
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
    expect(at(`${ISSUE}#rule:${PAID_ONLY}`).pattern).toBe('state_change');
  });

  it("hangs a rule's scenarios under the rule, not beside it", () => {
    const rule = `${ISSUE}#rule:${NOT_EXCEEDING}`;
    expect(childrenOf(rule)).toEqual([
      'Refunding more than was paid',
      'Refunding one line of a paid order',
      'Refunding without a receipt',
    ]);
    expect(at(`${rule}#scenario:${MORE_THAN_PAID}`)).toMatchObject({
      kind: 'scenario',
      change: 'added',
      parentPath: rule,
      depth: at(rule).depth + 1,
    });
    expect(at(`${rule}#scenario:${WITHOUT_RECEIPT}`).change).toBe('removed');
  });

  it('reads the owner and the rule back off a part path, and the part by its key', () => {
    expect(ownerOfPart(ISSUE)).toEqual({ elementId: ISSUE, rule: null });
    expect(ownerOfPart(`${ISSUE}#rule:${NOT_EXCEEDING}`)).toEqual({
      elementId: ISSUE,
      rule: NOT_EXCEEDING,
    });
    expect(partKeyOf(at(`${ISSUE}#rule:${NOT_EXCEEDING}`))).toBe(NOT_EXCEEDING);
    expect(
      partKeyOf(
        at(`${ISSUE}#rule:${NOT_EXCEEDING}#scenario:${MORE_THAN_PAID}`),
      ),
    ).toBe(MORE_THAN_PAID);
  });

  it('labels a part with its own type, spelled as the design spells it', () => {
    const labelAt = (path: string) => at(path).patternLabel;
    const refund = 'building_block|sales.refunds.Refund';
    // A type is a name somebody wrote: writing it out would leave `Orderid`
    // beside a `RefundLine [*]` that kept its own spelling, and `date` — a
    // primitive the model does spell in lower case — would read `Date`.
    expect(labelAt(`${refund}#property:orderId`)).toBe('OrderId');
    expect(labelAt(`${refund}#property:lines`)).toBe('RefundLine [*]');
    expect(labelAt(`${refund}#property:issuedAt`)).toBe('date');
    // A rule's is its kind, written out.
    expect(labelAt(`${ISSUE}#rule:${PAID_ONLY}`)).toBe('State change');
    // An element's pattern is the model's own word, and is written out.
    expect(labelAt(refund)).toBe('Aggregate');
  });

  it('names an element by its own name, never by its address', () => {
    expect(at('building_block|sales.refunds.Refund').name).toBe('Refund');
    expect(at('module|sales.refunds').name).toBe('refunds');
  });

  it('marks the one element that draws a diagram', () => {
    expect(
      outline.filter((node) => node.hasDiagram).map((node) => node.path),
    ).toEqual(['behavior|sales.refunds.Refund.issue']);
  });

  it('marks an element whose definition still draws one in a fence', () => {
    const fenced = outlineOf({
      id: '2026-01-01-fenced',
      name: 'Fenced',
      description: '',
      modules: {
        added: [
          {
            id: 'module|sales',
            definition: {
              value: 'Sales.\n\n```mermaid\nflowchart TD\n  A --> B\n```',
            },
          },
        ],
      },
    });

    expect(
      fenced.find((node) => node.path === 'module|sales')?.hasDiagram,
    ).toBe(true);
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
