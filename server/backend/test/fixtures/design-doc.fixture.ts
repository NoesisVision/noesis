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
  needs: {
    added: [
      {
        id: 'refund-single-lines',
        name: byAgent('Refund single lines'),
        stakeholder: byAgent('Support agents'),
        statement: byHuman(
          'Support agents need to refund one line of an order when the customer returns only part of it.',
        ),
      },
    ],
    removed: [],
    modified: [],
  },
  modules: {
    added: [
      {
        id: 'module|sales.refunds',
        name: byAgent('refunds'),
        definition: byAgent(
          'Everything about giving money back to a customer.',
        ),
        diagram: unchanged,
        rules: {
          added: [
            {
              name: 'A refund is issued within a second',
              category: byAgent('Quality'),
              ruleType: byAgent('Performance'),
              description: byAgent(
                'Issuing a refund answers within one second for an order of up to 100 lines.',
              ),
              needs: byAgent(['refund-single-lines']),
              rationale: unchanged,
              scenarios: noChanges,
            },
          ],
          removed: [],
          modified: [],
        },
      },
    ],
    removed: ['module|sales.credit-notes'],
    modified: [
      {
        id: 'module|sales.orders',
        name: unchanged,
        definition: byHuman(
          'Order lifecycle, now including the refundable state of each line.',
        ),
        diagram: unchanged,
        rules: noChanges,
      },
    ],
  },
  buildingBlocks: {
    added: [
      {
        id: 'building_block|sales.refunds.Refund',
        name: byHuman('Refund'),
        type: byHuman('aggregate'),
        definition: byAgent('A refund of one or more lines of a single order.'),
        diagram: unchanged,
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
              category: byAgent('Business'),
              ruleType: byAgent('Consistency'),
              description: byHuman(
                'The sum of all refunds of an order is at most what the customer paid for it.',
              ),
              needs: byAgent(['refund-single-lines']),
              rationale: byAgent(
                'Support may not pay out more than the order brought in.',
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
        type: byAgent('value_object'),
        definition: byAgent('Tells the ledger a refund went out.'),
        diagram: unchanged,
        implements: noAdditions,
        properties: noChanges,
        rules: noChanges,
        scenarios: noChanges,
      },
      {
        id: 'building_block|sales.refunds.RefundRepository',
        name: byAgent('RefundRepository'),
        type: byAgent('repository'),
        definition: byAgent('Stores refunds.'),
        diagram: unchanged,
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
        definition: unchanged,
        diagram: unchanged,
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
        definition: byAgent(
          'Issues a refund for the chosen lines of an order.',
        ),
        diagram: byAgent(
          'sequenceDiagram\n  Support agent->>Refund: issue(orderId, lines)\n  Refund-->>Support agent: RefundIssued',
        ),
        visibility: byHuman({ kind: 'public', actors: ['Support agent'] }),
        input: {
          added: [
            {
              name: 'orderId',
              type: byAgent('building_block|sales.orders.OrderId'),
              description: byAgent('The order to refund.'),
              optional: byAgent(false),
            },
            {
              name: 'lines',
              type: byAgent({
                collectionOf: 'building_block|sales.refunds.RefundLine',
              }),
              description: byAgent('The lines to refund.'),
              optional: byAgent(false),
            },
            {
              name: 'reason',
              type: byHuman('primitive|string'),
              description: byAgent('Why support refunds the lines.'),
              optional: byAgent(true),
            },
          ],
          removed: [],
          modified: [],
        },
        output: {
          added: [
            {
              type: 'building_block|sales.refunds.RefundIssued',
              description: byAgent('Tells the ledger the refund went out.'),
              optional: byAgent(false),
            },
          ],
          removed: [],
          modified: [],
        },
        rules: {
          added: [
            {
              name: 'Only paid orders are refundable',
              category: byAgent('Business'),
              ruleType: byAgent('State change'),
              description: byAgent('An unpaid order has nothing to refund.'),
              needs: byAgent([]),
              rationale: unchanged,
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
        definition: unchanged,
        diagram: unchanged,
        visibility: byAgent({ kind: 'private' }),
        input: {
          added: [],
          removed: ['force'],
          modified: [
            {
              name: 'reason',
              type: unchanged,
              description: byAgent('Shown to the customer.'),
              optional: unchanged,
            },
          ],
        },
        output: {
          added: [],
          removed: [],
          modified: [
            {
              type: 'building_block|sales.orders.OrderCancelled',
              description: byAgent('Now also names the reason.'),
              optional: unchanged,
            },
          ],
        },
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
  needs: { added: byAgentOnly.needs.added },
  modules: { added: byAgentOnly.modules.added },
  buildingBlocks: { added: byAgentOnly.buildingBlocks.added },
  behaviours: { added: byAgentOnly.behaviours.added },
};

/*
 * The same additions as a human revised them: some fields in their own name,
 * which only a human may write.
 */
export const humanEditedDesignDocFixture: DesignDocumentInput = {
  ...designDocFixture,
  needs: { added: designDocFixture.needs.added },
  modules: { added: designDocFixture.modules.added },
  buildingBlocks: { added: designDocFixture.buildingBlocks.added },
  behaviours: { added: designDocFixture.behaviours.added },
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
