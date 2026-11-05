import type { DesignDocumentInput } from '#backend/app/design-docs/design-doc.ts';

/*
 * A design that changes something at every level, in the JSON form the wire
 * carries: an element added, modified and removed at each of the three kinds,
 * a part of each kind, rules a behavior governs — traced to a need and to
 * none, one with scenarios — a rule the design names no behavior of, which
 * sits under its module, and one element that draws a diagram. Only what the
 * outline reads is spelled out — the bodies of the fields are the detail
 * panel's business, not the tree's.
 */

const human = <const T>(value: T) => ({ value, author: 'human' as const });
const agent = <const T>(value: T) => ({ value, author: 'agent' as const });

const ISSUE_DIAGRAM = [
  'flowchart TD',
  '  accTitle: Issuing a refund',
  '  A[Order] --> B[Refund]',
].join('\n');

const ISSUE = 'behavior|sales.refunds.Refund.issue';
export const WITHIN_A_SECOND =
  'rule|sales.refunds.A refund is issued within a second';
export const NOT_EXCEEDING =
  'rule|sales.refunds.Refund never exceeds paid amount';
export const PAID_ONLY = 'rule|sales.refunds.Only paid orders are refundable';
const scenarioOf = (rule: string, name: string) =>
  `scenario|${rule.slice('rule|'.length)}.${name}`;
export const MORE_THAN_PAID = scenarioOf(
  NOT_EXCEEDING,
  'Refunding more than was paid',
);
const ONE_LINE = scenarioOf(
  NOT_EXCEEDING,
  'Refunding one line of a paid order',
);
export const WITHOUT_RECEIPT = scenarioOf(
  NOT_EXCEEDING,
  'Refunding without a receipt',
);

export const changedEverywhereFixture = {
  id: '2026-01-01-partial-refunds-for-orders',
  name: 'Partial refunds for orders',
  description: 'Refund single order lines.',
  needs: {
    added: [
      {
        id: 'refund-single-lines',
        name: agent('Refund single lines'),
        stakeholder: agent('Support agents'),
        statement: agent('Support agents need to refund one line of an order.'),
      },
    ],
  },
  modules: {
    added: [
      {
        id: 'module|sales.refunds',
        definition: agent('Giving money back.'),
      },
    ],
    removed: ['module|sales.credit-notes'],
    modified: [
      { id: 'module|sales.orders', definition: human('Order lifecycle.') },
    ],
  },
  buildingBlocks: {
    added: [
      {
        id: 'building_block|sales.refunds.Refund',
        type: human('aggregate'),
        definition: agent('A refund of one or more lines of an order.'),
      },
      {
        id: 'building_block|sales.refunds.RefundIssued',
        type: agent('value_object'),
      },
      {
        id: 'building_block|sales.refunds.RefundRepository',
        type: agent('repository'),
      },
    ],
    removed: ['building_block|sales.credit-notes.CreditNote'],
    modified: [{ id: 'building_block|sales.orders.Order' }],
  },
  rules: {
    added: [
      {
        id: NOT_EXCEEDING,
        name: agent('Refund never exceeds paid amount'),
        kind: agent('validation'),
        needs: agent(['refund-single-lines']),
        rationale: human('Support never pays out more than came in.'),
      },
      {
        id: PAID_ONLY,
        name: agent('Only paid orders are refundable'),
        kind: agent('state_change'),
        needs: agent([]),
      },
    ],
    modified: [
      {
        id: WITHIN_A_SECOND,
        kind: agent('configuration'),
        description: agent('Issuing a refund answers within a second.'),
        needs: agent(['refund-single-lines']),
      },
    ],
  },
  scenarios: {
    added: [
      {
        id: MORE_THAN_PAID,
        name: agent('Refunding more than was paid'),
        steps: agent([
          { kind: 'given', text: 'an order paid 100' },
          { kind: 'when', text: 'support refunds 120' },
          { kind: 'then', text: 'the refund is refused' },
        ]),
      },
      {
        id: ONE_LINE,
        name: agent('Refunding one line of a paid order'),
        description: agent('The happy path of a partial refund.'),
        steps: agent([
          { kind: 'given', text: 'a paid order with two lines' },
          { kind: 'when', text: 'support refunds the first line' },
          { kind: 'then', text: 'the line is refunded' },
        ]),
      },
    ],
    removed: [WITHOUT_RECEIPT],
  },
  relations: {
    added: [
      { kind: 'governs', from: ISSUE, to: NOT_EXCEEDING },
      { kind: 'governs', from: ISSUE, to: PAID_ONLY },
      { kind: 'illustrates', from: MORE_THAN_PAID, to: NOT_EXCEEDING },
      { kind: 'illustrates', from: ONE_LINE, to: NOT_EXCEEDING },
      {
        kind: 'has_state',
        from: 'building_block|sales.refunds.Refund',
        name: 'orderId',
        to: agent('building_block|sales.orders.OrderId'),
        cardinality: agent('1'),
      },
      {
        kind: 'has_state',
        from: 'building_block|sales.refunds.Refund',
        name: 'lines',
        to: agent('building_block|sales.refunds.RefundLine'),
        cardinality: agent('*'),
      },
      {
        kind: 'has_state',
        from: 'building_block|sales.refunds.Refund',
        name: 'issuedAt',
        to: agent('primitive|date'),
        cardinality: agent('1'),
      },
      {
        kind: 'has_state',
        from: 'building_block|sales.orders.Order',
        name: 'refundedAmount',
        to: agent('building_block|sales.Money'),
        cardinality: agent('1'),
      },
    ],
    removed: [
      {
        kind: 'has_state',
        from: 'building_block|sales.orders.Order',
        to: 'primitive|uuid',
        name: 'creditNoteId',
      },
    ],
    modified: [
      {
        kind: 'has_state',
        from: 'building_block|sales.orders.Order',
        name: 'status',
        to: human('building_block|sales.orders.OrderStatus'),
      },
    ],
  },
  behaviors: {
    added: [
      {
        id: 'behavior|sales.refunds.Refund.issue',
        definition: agent('How a refund is issued.'),
        diagram: agent(ISSUE_DIAGRAM),
      },
    ],
    removed: ['behavior|sales.credit-notes.CreditNote.issue'],
    modified: [{ id: 'behavior|sales.orders.Order.cancel' }],
  },
} satisfies DesignDocumentInput;
