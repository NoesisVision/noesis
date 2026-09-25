import {
  DesignDocument,
  type DesignDocumentInput,
} from '#backend/app/design-docs/design-doc';

/*
 * The JSON form, with every default spelled out, so that decoding and
 * encoding it again gives back exactly this object. Keeps one of every shape
 * the specs rely on: an element added, modified and removed at every level,
 * a part of each kind, unchanged fields and changed fields of both authors,
 * every kind of type including a nested collection, a public behaviour.
 */

const byHuman = <const T>(value: T) => ({
  changed: true as const,
  value,
  author: 'human' as const,
});
const byAgent = <const T>(value: T) => ({
  changed: true as const,
  value,
  author: 'agent' as const,
});
const unchanged = { changed: false as const };
const noChanges = { added: [], removed: [], modified: [] };
const noAdditions = { added: [], removed: [] };

const REFUND_OUTCOME =
  "a refund for that line's amount is issued and the second line stays refundable";

export const designDocFixture = {
  id: '2026-01-01-partial-refunds-for-orders',
  name: 'Partial refunds for orders',
  description:
    'Lets support refund individual order lines instead of the whole order, and retires the legacy credit note flow.',
  modules: {
    added: [
      {
        id: 'module|sales.refunds',
        name: byAgent('refunds'),
        description: byAgent(
          'Everything about giving money back to a customer.',
        ),
      },
    ],
    removed: ['module|sales.credit-notes'],
    modified: [
      {
        id: 'module|sales.orders',
        name: unchanged,
        description: byHuman(
          'Order lifecycle, now including the refundable state of each line.',
        ),
      },
    ],
  },
  buildingBlocks: {
    added: [
      {
        id: 'building_block|sales.refunds.Refund',
        name: byHuman('Refund'),
        type: byHuman('aggregate'),
        description: byAgent(
          'A refund of one or more lines of a single order.',
        ),
        implements: noAdditions,
        properties: {
          added: [
            {
              name: 'orderId',
              type: byHuman('building_block|sales.orders.OrderId'),
              description: byAgent('The order the refunded lines belong to.'),
              optional: byAgent(false),
            },
            {
              name: 'lines',
              type: byAgent({
                collectionOf: 'building_block|sales.refunds.RefundLine',
              }),
              description: byAgent('The refunded lines.'),
              optional: byAgent(false),
            },
            {
              name: 'notes',
              type: byAgent({
                collectionOf: { collectionOf: 'primitive|string' },
              }),
              description: byAgent('Notes per line, several per line.'),
              optional: byAgent(false),
            },
            {
              name: 'issuedAt',
              type: byAgent('primitive|datetime'),
              description: byAgent('When the refund was issued.'),
              optional: byAgent(true),
            },
          ],
          removed: [],
          modified: [],
        },
        rules: {
          added: [
            {
              name: 'Refund never exceeds paid amount',
              ruleType: byAgent('Consistency'),
              description: byHuman(
                'The sum of all refunds of an order is at most what the customer paid for it.',
              ),
              scenarios: noChanges,
            },
          ],
          removed: [],
          modified: [],
        },
        scenarios: {
          added: [
            {
              name: 'Refunding one line of a paid order',
              description: byAgent('The happy path of a partial refund.'),
              given: byAgent('a paid order with two lines'),
              when: byAgent('support refunds the first line'),
              // oxlint-disable-next-line unicorn/no-thenable
              then: byAgent(REFUND_OUTCOME), // NOSONAR
            },
          ],
          removed: [],
          modified: [],
        },
      },
      {
        id: 'building_block|sales.refunds.RefundIssued',
        name: byAgent('RefundIssued'),
        type: byAgent('domain_event'),
        description: byAgent('Tells the ledger a refund went out.'),
        implements: noAdditions,
        properties: noChanges,
        rules: noChanges,
        scenarios: noChanges,
      },
      {
        id: 'building_block|sales.refunds.RefundRepository',
        name: byAgent('RefundRepository'),
        type: byAgent('repository'),
        description: byAgent('Stores refunds.'),
        implements: {
          added: ['building_block|sales.shared.Repository'],
          removed: [],
        },
        properties: noChanges,
        rules: noChanges,
        scenarios: noChanges,
      },
    ],
    removed: ['building_block|sales.credit-notes.CreditNote'],
    modified: [
      {
        id: 'building_block|sales.orders.Order',
        name: unchanged,
        type: unchanged,
        description: unchanged,
        implements: noAdditions,
        properties: {
          added: [
            {
              name: 'refundedAmount',
              type: byAgent('building_block|sales.shared.Money'),
              description: byAgent('What has been refunded so far.'),
              optional: byAgent(false),
            },
          ],
          removed: ['creditNoteId'],
          modified: [
            {
              name: 'status',
              type: unchanged,
              description: byAgent("Gains the 'partially_refunded' state."),
              optional: unchanged,
            },
          ],
        },
        rules: noChanges,
        scenarios: noChanges,
      },
    ],
  },
  behaviours: {
    added: [
      {
        id: 'behavior|sales.refunds.Refund.issue',
        name: byAgent('issue'),
        type: byHuman('Command'),
        description: byAgent(
          'Issues a refund for the chosen lines of an order.',
        ),
        visibility: byHuman({ kind: 'public', actors: ['Support agent'] }),
        input: {
          added: [
            'building_block|sales.orders.OrderId',
            { collectionOf: 'building_block|sales.refunds.RefundLine' },
            'primitive|string',
          ],
          removed: [],
        },
        output: {
          added: ['building_block|sales.refunds.RefundIssued'],
          removed: [],
        },
        rules: {
          added: [
            {
              name: 'Only paid orders are refundable',
              ruleType: byAgent('State change'),
              description: byAgent('An unpaid order has nothing to refund.'),
              scenarios: noChanges,
            },
          ],
          removed: [],
          modified: [],
        },
        scenarios: noChanges,
      },
    ],
    removed: ['behavior|sales.credit-notes.CreditNote.issue'],
    modified: [
      {
        id: 'behavior|sales.orders.Order.cancel',
        name: unchanged,
        type: unchanged,
        description: unchanged,
        visibility: byAgent({ kind: 'private' }),
        input: noAdditions,
        output: noAdditions,
        rules: noChanges,
        scenarios: noChanges,
      },
    ],
  },
  implemented: false,
} satisfies DesignDocumentInput;

/** The decoded form, as the service takes it. */
export const decodedDesignDocFixture = DesignDocument.decode(designDocFixture);

/*
 * What an agent may write while nothing is scanned yet: the same design with
 * every field written by the agent, adding elements only.
 */
const byAgentOnly = asAgent(designDocFixture) as typeof designDocFixture;
export const greenFieldDesignDocFixture: DesignDocumentInput = {
  ...byAgentOnly,
  modules: { added: byAgentOnly.modules.added },
  buildingBlocks: { added: byAgentOnly.buildingBlocks.added },
  behaviours: { added: byAgentOnly.behaviours.added },
};

function asAgent(node: unknown): unknown {
  if (Array.isArray(node)) return node.map(asAgent);
  if (typeof node !== 'object' || node === null) return node;
  return Object.fromEntries(
    Object.entries(node).map(([key, value]) => [
      key,
      key === 'author' ? 'agent' : asAgent(value),
    ]),
  );
}
