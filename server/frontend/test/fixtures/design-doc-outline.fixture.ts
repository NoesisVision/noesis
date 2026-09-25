import type { DesignDocumentInput } from '#backend/app/design-docs/design-doc.ts';

/*
 * A design that changes something at every level, in the JSON form the wire
 * carries: an element added, modified and removed at each of the three kinds,
 * a part of each kind, and one description that draws a diagram. Only what the
 * outline reads is spelled out — the bodies of the fields are the detail
 * panel's business, not the tree's.
 */

const human = <const T>(value: T) => ({ value, author: 'human' as const });
const agent = <const T>(value: T) => ({ value, author: 'agent' as const });

const ISSUE_DIAGRAM = [
  'How a refund is issued.',
  '',
  '```mermaid',
  'flowchart TD',
  '  accTitle: Issuing a refund',
  '  A[Order] --> B[Refund]',
  '```',
].join('\n');

export const changedEverywhereFixture = {
  id: '2026-01-01-partial-refunds-for-orders',
  name: 'Partial refunds for orders',
  description: 'Refund single order lines.',
  modules: {
    added: [
      {
        id: 'module|sales.refunds',
        description: agent('Giving money back.'),
      },
    ],
    removed: ['module|sales.credit-notes'],
    modified: [
      { id: 'module|sales.orders', description: human('Order lifecycle.') },
    ],
  },
  buildingBlocks: {
    added: [
      {
        id: 'building_block|sales.refunds.Refund',
        type: human('aggregate'),
        description: agent('A refund of one or more lines of an order.'),
        properties: {
          added: [
            {
              name: 'orderId',
              type: agent('building_block|sales.orders.OrderId'),
            },
            {
              name: 'lines',
              type: agent({
                collectionOf: 'building_block|sales.refunds.RefundLine',
              }),
            },
            { name: 'issuedAt', type: agent('primitive|date') },
          ],
        },
        rules: {
          added: [
            {
              name: 'Refund never exceeds paid amount',
              ruleType: agent('Consistency'),
            },
          ],
        },
        scenarios: {
          added: [
            {
              name: 'Refunding one line of a paid order',
              description: agent('The happy path of a partial refund.'),
              given: agent('a paid order with two lines'),
              when: agent('support refunds the first line'),
              // Gherkin's word; the fixture is never awaited.
              // oxlint-disable-next-line unicorn/no-thenable
              then: agent('the line is refunded'), // NOSONAR
            },
          ],
        },
      },
      {
        id: 'building_block|sales.refunds.RefundIssued',
        type: agent('domain_event'),
      },
      {
        id: 'building_block|sales.refunds.RefundRepository',
        type: agent('repository'),
      },
    ],
    removed: ['building_block|sales.credit-notes.CreditNote'],
    modified: [
      {
        id: 'building_block|sales.orders.Order',
        properties: {
          added: [
            {
              name: 'refundedAmount',
              type: agent('building_block|sales.Money'),
            },
          ],
          removed: ['creditNoteId'],
          modified: [
            {
              name: 'status',
              type: human('building_block|sales.orders.OrderStatus'),
            },
          ],
        },
      },
    ],
  },
  behaviours: {
    added: [
      {
        id: 'behavior|sales.refunds.Refund.issue',
        type: human('Command'),
        description: agent(ISSUE_DIAGRAM),
        rules: {
          added: [
            {
              name: 'Only paid orders are refundable',
              ruleType: agent('State change'),
            },
          ],
        },
      },
    ],
    removed: ['behavior|sales.credit-notes.CreditNote.issue'],
    modified: [{ id: 'behavior|sales.orders.Order.cancel' }],
  },
} satisfies DesignDocumentInput;
