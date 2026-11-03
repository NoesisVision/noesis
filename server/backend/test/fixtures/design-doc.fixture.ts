import {
  DesignDocument,
  type DesignDocumentInput,
} from '#backend/app/design-docs/design-doc';

/*
 * The JSON form, with every default spelled out, so that decoding and
 * encoding it again gives back exactly this object. Keeps one of every shape
 * the specs rely on: an element added, modified and removed at every level,
 * a relation of each kind added, modified or removed, unchanged fields and
 * changed fields of both authors, every cardinality, a public behavior.
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

const REFUND_OUTCOME =
  "a refund for that line's amount is issued and the second line stays refundable";

const REFUND = 'building_block|sales.refunds.Refund';
const REFUND_LINE = 'building_block|sales.refunds.RefundLine';
const REFUND_ISSUED = 'building_block|sales.refunds.RefundIssued';
const ISSUE = 'behavior|sales.refunds.Refund.issue';
const ORDER = 'building_block|sales.orders.Order';
const CANCEL = 'behavior|sales.orders.Order.cancel';

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
        id: REFUND,
        name: byHuman('Refund'),
        type: byHuman('aggregate'),
        definition: byAgent('A refund of one or more lines of a single order.'),
        diagram: unchanged,
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
        id: REFUND_LINE,
        name: byAgent('RefundLine'),
        type: byAgent('entity'),
        definition: byAgent('One refunded line of the order.'),
        diagram: unchanged,
        rules: noChanges,
        scenarios: noChanges,
      },
      {
        id: REFUND_ISSUED,
        name: byAgent('RefundIssued'),
        type: byAgent('value_object'),
        definition: byAgent('Tells the ledger a refund went out.'),
        diagram: unchanged,
        rules: noChanges,
        scenarios: noChanges,
      },
      {
        id: 'building_block|sales.refunds.RefundRepository',
        name: byAgent('RefundRepository'),
        type: byAgent('repository'),
        definition: byAgent('Stores refunds.'),
        diagram: unchanged,
        rules: noChanges,
        scenarios: noChanges,
      },
    ],
    removed: ['building_block|sales.credit-notes.CreditNote'],
    modified: [
      {
        id: ORDER,
        name: unchanged,
        type: unchanged,
        definition: unchanged,
        diagram: unchanged,
        rules: noChanges,
        scenarios: noChanges,
      },
    ],
  },
  behaviors: {
    added: [
      {
        id: ISSUE,
        name: byAgent('issue'),
        type: byHuman('Command'),
        definition: byAgent(
          'Issues a refund for the chosen lines of an order.',
        ),
        diagram: byAgent(
          'sequenceDiagram\n  Support agent->>Refund: issue(orderId, lines)\n  Refund-->>Support agent: RefundIssued',
        ),
        visibility: byHuman({ kind: 'public', actors: ['Support agent'] }),
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
        id: CANCEL,
        name: unchanged,
        type: unchanged,
        definition: unchanged,
        diagram: unchanged,
        visibility: byAgent({ kind: 'private' }),
        rules: noChanges,
        scenarios: noChanges,
      },
    ],
  },
  relations: {
    added: [
      {
        kind: 'has_state',
        from: REFUND,
        name: 'orderId',
        to: byHuman('primitive|uuid'),
        cardinality: byAgent('1'),
      },
      {
        kind: 'has_state',
        from: REFUND,
        name: 'lines',
        to: byAgent(REFUND_LINE),
        cardinality: byAgent('1..*'),
      },
      {
        kind: 'has_state',
        from: REFUND,
        name: 'notes',
        to: byAgent('primitive|string'),
        cardinality: byAgent('0..*'),
      },
      {
        kind: 'has_state',
        from: REFUND,
        name: 'issuedAt',
        to: byAgent('primitive|datetime'),
        cardinality: byAgent('0..1'),
      },
      {
        kind: 'has_state',
        from: REFUND_LINE,
        name: 'amount',
        to: byAgent('primitive|decimal'),
        cardinality: byAgent('1'),
      },
      {
        kind: 'exposes',
        from: REFUND,
        to: ISSUE,
      },
      {
        kind: 'has_input',
        from: ISSUE,
        name: 'orderId',
        to: byAgent('primitive|uuid'),
        cardinality: byAgent('1'),
        position: byAgent(1),
      },
      {
        kind: 'has_input',
        from: ISSUE,
        name: 'lines',
        to: byAgent(REFUND_LINE),
        cardinality: byAgent('1..*'),
        position: byAgent(2),
      },
      {
        kind: 'has_input',
        from: ISSUE,
        name: 'reason',
        to: byHuman('primitive|string'),
        cardinality: byAgent('0..1'),
        position: byAgent(3),
      },
      {
        kind: 'has_output',
        from: ISSUE,
        to: REFUND_ISSUED,
        cardinality: byAgent('1'),
      },
      {
        kind: 'contains',
        from: 'module|sales.refunds',
        to: REFUND,
      },
    ],
    removed: [
      { kind: 'has_state', from: ORDER, name: 'creditNoteId' },
      {
        kind: 'extends',
        from: ORDER,
        to: 'building_block|sales.shared.Legacy',
      },
      { kind: 'has_input', from: CANCEL, name: 'force' },
      {
        kind: 'invokes',
        from: CANCEL,
        to: 'behavior|sales.credit-notes.CreditNote.issue',
      },
    ],
    modified: [
      {
        kind: 'has_state',
        from: ORDER,
        name: 'status',
        to: unchanged,
        cardinality: byAgent('1'),
      },
      {
        kind: 'has_input',
        from: CANCEL,
        name: 'reason',
        to: unchanged,
        cardinality: byAgent('0..1'),
        position: unchanged,
      },
      {
        kind: 'has_output',
        from: CANCEL,
        to: 'building_block|sales.orders.OrderCancelled',
        cardinality: byAgent('1'),
      },
      {
        kind: 'invokes',
        from: CANCEL,
        to: 'behavior|sales.orders.Order.notify',
        order: byAgent(2),
      },
    ],
  },
  implemented: false,
} satisfies DesignDocumentInput;

/** The decoded form, as the service takes it. */
export const decodedDesignDocFixture = DesignDocument.decode(designDocFixture);

/*
 * What an agent may write while nothing is scanned yet: the same design with
 * every field written by the agent, adding elements and relations only.
 */
const byAgentOnly = asAgent(designDocFixture) as typeof designDocFixture;
export const greenFieldDesignDocFixture: DesignDocumentInput = {
  ...byAgentOnly,
  needs: { added: byAgentOnly.needs.added },
  modules: { added: byAgentOnly.modules.added },
  buildingBlocks: { added: byAgentOnly.buildingBlocks.added },
  behaviors: { added: byAgentOnly.behaviors.added },
  relations: { added: byAgentOnly.relations.added },
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
  behaviors: { added: designDocFixture.behaviors.added },
  relations: { added: designDocFixture.relations.added },
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
