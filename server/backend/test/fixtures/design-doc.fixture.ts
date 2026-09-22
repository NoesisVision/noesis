import type { DesignDocumentInput } from '#backend/app/design-docs/design-doc';

/*
 * The JSON form, with every default spelled out, so that decoding and
 * encoding it again gives back exactly this object. Keeps one of every shape
 * the specs rely on: an element added, modified and removed at every level,
 * a part of each kind, fields reviewed and unreviewed, a public behaviour.
 */

const reviewed = <const T>(value: T) => ({ value, reviewedByHuman: true });
const unreviewed = <const T>(value: T) => ({ value, reviewedByHuman: false });

export const designDocFixture = {
  id: 'refund-partial-orders',
  name: reviewed('Partial refunds for orders'),
  description: unreviewed(
    'Lets support refund individual order lines instead of the whole order, and retires the legacy credit note flow.',
  ),
  modules: {
    added: [
      {
        id: 'module|sales.refunds',
        description: unreviewed(
          'Everything about giving money back to a customer.',
        ),
      },
    ],
    removed: ['module|sales.credit-notes'],
    modified: [
      {
        id: 'module|sales.orders',
        description: reviewed(
          'Order lifecycle, now including the refundable state of each line.',
        ),
      },
    ],
  },
  buildingBlocks: {
    added: [
      {
        id: 'building_block|sales.refunds.Refund',
        type: reviewed('aggregate'),
        description: unreviewed(
          'A refund of one or more lines of a single order.',
        ),
        properties: {
          added: [
            {
              name: reviewed('orderId'),
              type: unreviewed('OrderId'),
              description: unreviewed(
                'The order the refunded lines belong to.',
              ),
            },
            {
              name: unreviewed('lines'),
              type: unreviewed('RefundLine'),
              description: unreviewed(null),
              collection: true,
            },
            {
              name: unreviewed('issuedAt'),
              type: unreviewed('Date'),
              description: unreviewed(null),
              nullable: true,
            },
          ],
          removed: [],
          modified: [],
        },
        rules: {
          added: [
            {
              name: reviewed('Refund never exceeds paid amount'),
              ruleType: 'Consistency',
              description: reviewed(
                'The sum of all refunds of an order is at most what the customer paid for it.',
              ),
            },
          ],
          removed: [],
          modified: [],
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
              then: unreviewed(
                "a refund for that line's amount is issued and the second line stays refundable",
              ),
            },
          ],
          removed: [],
          modified: [],
        },
      },
      {
        id: 'building_block|sales.refunds.RefundIssued',
        type: unreviewed('domain_event'),
        description: unreviewed(null),
      },
      {
        id: 'building_block|sales.refunds.RefundRepository',
        type: unreviewed('repository'),
        description: unreviewed(null),
        implements: ['building_block|sales.shared.Repository'],
      },
    ],
    removed: ['building_block|sales.credit-notes.CreditNote'],
    modified: [
      {
        id: 'building_block|sales.orders.Order',
        type: unreviewed(null),
        description: unreviewed(null),
        properties: {
          added: [
            {
              name: unreviewed('refundedAmount'),
              type: unreviewed('Money'),
              description: unreviewed(null),
            },
          ],
          removed: ['creditNoteId'],
          modified: [
            {
              name: reviewed('status'),
              type: reviewed('OrderStatus'),
              description: unreviewed("Gains the 'partially_refunded' state."),
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
        description: unreviewed(
          'Issues a refund for the chosen lines of an order.',
        ),
        type: reviewed('Command'),
        input: {
          added: ['OrderId', 'RefundLine[]'],
          removed: [],
          modified: [],
        },
        output: { added: ['RefundIssued'], removed: [], modified: [] },
        usedBuildingBlocks: {
          added: [
            'building_block|sales.orders.Order',
            'building_block|sales.refunds.RefundRepository',
          ],
          removed: [],
          modified: [],
        },
        rules: {
          added: [
            {
              name: unreviewed('Only paid orders are refundable'),
              ruleType: 'State change',
              description: unreviewed(null),
            },
          ],
          removed: [],
          modified: [],
        },
        isPublic: true,
        actor: reviewed('Support agent'),
      },
    ],
    removed: ['behavior|sales.credit-notes.CreditNote.issue'],
    modified: [
      {
        id: 'behavior|sales.orders.Order.cancel',
        description: unreviewed(null),
        type: unreviewed(null),
        usedBuildingBlocks: {
          added: ['building_block|sales.refunds.Refund'],
          removed: ['building_block|sales.credit-notes.CreditNote'],
          modified: [],
        },
        isPublic: false,
        actor: unreviewed(null),
      },
    ],
  },
  implemented: false,
} satisfies DesignDocumentInput;
