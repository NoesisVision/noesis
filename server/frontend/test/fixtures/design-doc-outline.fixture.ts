import type { DesignDocumentInput } from '#backend/app/design-docs/design-doc.ts';

/*
 * A design that changes something at every level, in the JSON form the wire
 * carries: an element added, modified and removed at each of the three kinds,
 * a part of each kind, and one description that draws a diagram. Only what the
 * outline reads is spelled out — the bodies of the fields are the detail
 * panel's business, not the tree's.
 */

const reviewed = <const T>(value: T) => ({ value, reviewedByHuman: true });
const unreviewed = <const T>(value: T) => ({ value, reviewedByHuman: false });

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
  name: reviewed('Partial refunds for orders'),
  description: unreviewed('Refund single order lines.'),
  modules: {
    added: [
      {
        id: 'module|sales.refunds',
        description: unreviewed('Giving money back.'),
      },
    ],
    removed: ['module|sales.credit-notes'],
    modified: [
      { id: 'module|sales.orders', description: reviewed('Order lifecycle.') },
    ],
  },
  buildingBlocks: {
    added: [
      {
        id: 'building_block|sales.refunds.Refund',
        type: reviewed('aggregate'),
        description: unreviewed('A refund of one or more lines of an order.'),
        properties: {
          added: [
            { name: reviewed('orderId'), type: unreviewed('OrderId') },
            { name: unreviewed('lines'), type: unreviewed('RefundLine') },
            { name: unreviewed('issuedAt'), type: unreviewed('Date') },
          ],
        },
        rules: {
          added: [
            {
              name: reviewed('Refund never exceeds paid amount'),
              ruleType: 'Consistency',
            },
          ],
        },
        scenarios: {
          added: [
            {
              name: unreviewed('Refunding one line of a paid order'),
              description: unreviewed('The happy path of a partial refund.'),
              given: unreviewed('a paid order with two lines'),
              when: unreviewed('support refunds the first line'),
              // Gherkin's word; the fixture is never awaited.
              // oxlint-disable-next-line unicorn/no-thenable
              then: unreviewed('the line is refunded'), // NOSONAR
            },
          ],
        },
      },
      {
        id: 'building_block|sales.refunds.RefundIssued',
        type: unreviewed('domain_event'),
      },
      {
        id: 'building_block|sales.refunds.RefundRepository',
        type: unreviewed('repository'),
      },
    ],
    removed: ['building_block|sales.credit-notes.CreditNote'],
    modified: [
      {
        id: 'building_block|sales.orders.Order',
        properties: {
          added: [
            { name: unreviewed('refundedAmount'), type: unreviewed('Money') },
          ],
          removed: ['creditNoteId'],
          modified: [
            { name: reviewed('status'), type: reviewed('OrderStatus') },
          ],
        },
      },
    ],
  },
  behaviours: {
    added: [
      {
        id: 'behavior|sales.refunds.Refund.issue',
        type: reviewed('Command'),
        description: unreviewed(ISSUE_DIAGRAM),
        rules: {
          added: [
            {
              name: unreviewed('Only paid orders are refundable'),
              ruleType: 'State change',
            },
          ],
        },
      },
    ],
    removed: ['behavior|sales.credit-notes.CreditNote.issue'],
    modified: [{ id: 'behavior|sales.orders.Order.cancel' }],
  },
} satisfies DesignDocumentInput;
