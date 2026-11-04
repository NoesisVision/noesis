import {
  DesignDocument,
  type DesignDocumentInput,
} from '#backend/app/design-docs/design-doc';

/*
 * The JSON form, with every default spelled out, so that decoding and
 * encoding it again gives back exactly this object. Keeps one of every shape
 * the specs rely on: an element added, modified and removed at every level,
 * a part of each kind, unchanged fields and changed fields of both authors,
 * every kind of type including a nested collection, a public behavior.
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

const SALES = 'module|sales';
const REFUNDS = 'module|sales.refunds';
const CREDIT_NOTES = 'module|sales.credit-notes';
const REFUND = 'building_block|sales.refunds.Refund';
const REFUND_ISSUED = 'building_block|sales.refunds.RefundIssued';
const REFUND_REPOSITORY = 'building_block|sales.refunds.RefundRepository';

const contains = <const Kind extends string>(
  kind: Kind,
  from: string,
  to: string,
) => ({ kind, from, to });
const refundsContains = {
  added: [
    contains('contains_building_block', REFUNDS, REFUND),
    contains('contains_building_block', REFUNDS, REFUND_ISSUED),
    contains('contains_building_block', REFUNDS, REFUND_REPOSITORY),
  ],
  removed: [],
};

/** The root module, which gains the refunds module: added in a green field, modified once scanned. */
const salesRoot = {
  id: SALES,
  name: byAgent('sales'),
  definition: byAgent('Selling to customers.'),
  diagram: unchanged,
  relations: {
    added: [contains('contains_module', SALES, REFUNDS)],
    removed: [],
  },
  rules: noChanges,
};

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
        id: REFUNDS,
        name: byAgent('refunds'),
        definition: byAgent(
          'Everything about giving money back to a customer.',
        ),
        diagram: unchanged,
        relations: refundsContains,
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
    removed: [CREDIT_NOTES],
    modified: [
      {
        id: SALES,
        name: unchanged,
        definition: unchanged,
        diagram: unchanged,
        relations: {
          added: [contains('contains_module', SALES, REFUNDS)],
          removed: [contains('contains_module', SALES, CREDIT_NOTES)],
        },
        rules: noChanges,
      },
      {
        id: 'module|sales.orders',
        name: unchanged,
        definition: byHuman(
          'Order lifecycle, now including the refundable state of each line.',
        ),
        diagram: unchanged,
        relations: noAdditions,
        rules: noChanges,
      },
    ],
  },
  buildingBlocks: {
    added: [
      {
        id: REFUND,
        name: byHuman('Refund'),
        type: byHuman('aggregate'),
        definition: byAgent('A refund of one or more lines of a single order.'),
        diagram: unchanged,
        relations: {
          added: [
            contains(
              'contains_behavior',
              REFUND,
              'behavior|sales.refunds.Refund.issue',
            ),
          ],
          removed: [],
        },
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
              steps: byAgent([
                { kind: 'given', text: 'a paid order with two lines' },
                { kind: 'when', text: 'support refunds the first line' },
                { kind: 'then', text: REFUND_OUTCOME },
              ]),
            },
          ],
          removed: [],
          modified: [],
        },
      },
      {
        id: REFUND_ISSUED,
        name: byAgent('RefundIssued'),
        type: byAgent('value_object'),
        definition: byAgent('Tells the ledger a refund went out.'),
        diagram: unchanged,
        relations: noAdditions,
        properties: noChanges,
        rules: noChanges,
        scenarios: noChanges,
      },
      {
        id: REFUND_REPOSITORY,
        name: byAgent('RefundRepository'),
        type: byAgent('repository'),
        definition: byAgent('Stores refunds.'),
        diagram: unchanged,
        relations: {
          added: [
            {
              kind: 'implements',
              from: REFUND_REPOSITORY,
              to: 'building_block|sales.shared.Repository',
            },
          ],
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
        relations: noAdditions,
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
  behaviors: {
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
        relations: noAdditions,
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
        relations: noAdditions,
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
  modules: { added: [salesRoot, ...byAgentOnly.modules.added] },
  buildingBlocks: { added: byAgentOnly.buildingBlocks.added },
  behaviors: { added: byAgentOnly.behaviors.added },
};

/*
 * The same additions as a human revised them: some fields in their own name,
 * which only a human may write.
 */
export const humanEditedDesignDocFixture: DesignDocumentInput = {
  ...designDocFixture,
  needs: { added: designDocFixture.needs.added },
  modules: { added: [salesRoot, ...designDocFixture.modules.added] },
  buildingBlocks: { added: designDocFixture.buildingBlocks.added },
  behaviors: { added: designDocFixture.behaviors.added },
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
