import {
  DesignDocument,
  type DesignDocumentInput,
} from '#backend/app/design-docs/design-doc';

/*
 * The JSON form, with every default spelled out, so that decoding and
 * encoding it again gives back exactly this object. Keeps one of every shape
 * the specs rely on: an element added, modified and removed at every level,
 * a part of each kind, fields of every status, a public behaviour.
 */

const acceptedByHuman = <const T>(value: T) => ({
  value,
  status: 'acceptedByHuman' as const,
});
const setByAgent = <const T>(value: T) => ({
  value,
  status: 'setByAgent' as const,
});
const setByHuman = <const T>(value: T) => ({
  value,
  status: 'setByHuman' as const,
});

const REFUND_OUTCOME =
  "a refund for that line's amount is issued and the second line stays refundable";

export const designDocFixture = {
  id: 'refund-partial-orders',
  name: acceptedByHuman('Partial refunds for orders'),
  description: setByAgent(
    'Lets support refund individual order lines instead of the whole order, and retires the legacy credit note flow.',
  ),
  modules: {
    added: [
      {
        id: 'module|sales.refunds',
        description: setByAgent(
          'Everything about giving money back to a customer.',
        ),
      },
    ],
    removed: ['module|sales.credit-notes'],
    modified: [
      {
        id: 'module|sales.orders',
        description: acceptedByHuman(
          'Order lifecycle, now including the refundable state of each line.',
        ),
      },
    ],
  },
  buildingBlocks: {
    added: [
      {
        id: 'building_block|sales.refunds.Refund',
        type: acceptedByHuman('aggregate'),
        description: setByAgent(
          'A refund of one or more lines of a single order.',
        ),
        properties: {
          added: [
            {
              name: acceptedByHuman('orderId'),
              type: setByAgent('OrderId'),
              description: setByAgent(
                'The order the refunded lines belong to.',
              ),
            },
            {
              name: setByAgent('lines'),
              type: setByAgent('RefundLine'),
              description: setByAgent(null),
              collection: true,
            },
            {
              name: setByAgent('issuedAt'),
              type: setByAgent('Date'),
              description: setByAgent(null),
              nullable: true,
            },
          ],
          removed: [],
          modified: [],
        },
        rules: {
          added: [
            {
              name: acceptedByHuman('Refund never exceeds paid amount'),
              ruleType: 'Consistency',
              description: acceptedByHuman(
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
              name: setByAgent('Refunding one line of a paid order'),
              description: setByAgent('The happy path of a partial refund.'),
              given: setByAgent('a paid order with two lines'),
              when: setByAgent('support refunds the first line'),
              // Gherkin's word; the fixture is never awaited.
              // oxlint-disable-next-line unicorn/no-thenable
              then: setByAgent(REFUND_OUTCOME), // NOSONAR
            },
          ],
          removed: [],
          modified: [],
        },
      },
      {
        id: 'building_block|sales.refunds.RefundIssued',
        type: setByAgent('domain_event'),
        description: setByAgent(null),
      },
      {
        id: 'building_block|sales.refunds.RefundRepository',
        type: setByAgent('repository'),
        description: setByAgent(null),
        implements: ['building_block|sales.shared.Repository'],
      },
    ],
    removed: ['building_block|sales.credit-notes.CreditNote'],
    modified: [
      {
        id: 'building_block|sales.orders.Order',
        type: setByAgent(null),
        description: setByAgent(null),
        properties: {
          added: [
            {
              name: setByAgent('refundedAmount'),
              type: setByAgent('Money'),
              description: setByAgent(null),
            },
          ],
          removed: ['creditNoteId'],
          modified: [
            {
              name: acceptedByHuman('status'),
              type: acceptedByHuman('OrderStatus'),
              description: setByAgent("Gains the 'partially_refunded' state."),
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
        description: setByAgent(
          'Issues a refund for the chosen lines of an order.',
        ),
        type: acceptedByHuman('Command'),
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
              name: setByAgent('Only paid orders are refundable'),
              ruleType: 'State change',
              description: setByAgent(null),
            },
          ],
          removed: [],
          modified: [],
        },
        isPublic: true,
        actor: setByHuman('Support agent'),
      },
    ],
    removed: ['behavior|sales.credit-notes.CreditNote.issue'],
    modified: [
      {
        id: 'behavior|sales.orders.Order.cancel',
        description: setByAgent(null),
        type: setByAgent(null),
        usedBuildingBlocks: {
          added: ['building_block|sales.refunds.Refund'],
          removed: ['building_block|sales.credit-notes.CreditNote'],
          modified: [],
        },
        isPublic: false,
        actor: setByAgent(null),
      },
    ],
  },
  implemented: false,
} satisfies DesignDocumentInput;

/** The decoded form, as the service takes it. */
export const decodedDesignDocFixture = DesignDocument.decode(designDocFixture);
