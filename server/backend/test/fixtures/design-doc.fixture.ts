import {
  DesignDocument,
  type DesignDocumentInput,
} from '#backend/app/design-docs/design-doc';

/*
 * The JSON form, with every default spelled out, so that decoding and
 * encoding it again gives back exactly this object. Keeps one of every shape
 * the specs rely on: an element added, modified and removed at every level,
 * a relation of each kind, named slots added, modified and removed, unchanged
 * fields and changed fields of both authors, every cardinality, a public
 * behavior.
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

const SALES = 'module|sales';
const REFUNDS = 'module|sales.refunds';
const CREDIT_NOTES = 'module|sales.credit-notes';
const REFUND = 'building_block|sales.refunds.Refund';
const REFUND_LINE = 'building_block|sales.refunds.RefundLine';
const REFUND_ISSUED = 'building_block|sales.refunds.RefundIssued';
const REFUND_REPOSITORY = 'building_block|sales.refunds.RefundRepository';
const ISSUE = 'behavior|sales.refunds.Refund.issue';
const ORDER = 'building_block|sales.orders.Order';
const CANCEL = 'behavior|sales.orders.Order.cancel';

/** The root module, which gains the refunds module: added in a green field, modified once scanned. */
const salesRoot = {
  id: SALES,
  name: byAgent('sales'),
  definition: byAgent('Selling to customers.'),
  diagram: unchanged,
  rules: noChanges,
};

const slot = <const To extends string>(
  kind: 'has_state' | 'has_input',
  from: string,
  name: string,
  to: { changed: true; value: To; author: 'agent' | 'human' },
  cardinality: '0..1' | '1' | '*',
) => ({ kind, from, name, to, cardinality: byAgent(cardinality) });
const input = (
  name: string,
  to: { changed: true; value: string; author: 'agent' | 'human' },
  cardinality: '0..1' | '1' | '*',
  position: number,
) => ({
  ...slot('has_input', ISSUE, name, to, cardinality),
  position: byAgent(position),
});

/** The relations the design adds between elements it adds, or to primitives: a green field may add them. */
const relationsWithinTheDesign = [
  { kind: 'module_contains_module', from: SALES, to: REFUNDS },
  { kind: 'module_contains_block', from: REFUNDS, to: REFUND },
  { kind: 'module_contains_block', from: REFUNDS, to: REFUND_LINE },
  { kind: 'module_contains_block', from: REFUNDS, to: REFUND_ISSUED },
  { kind: 'module_contains_block', from: REFUNDS, to: REFUND_REPOSITORY },
  { kind: 'exposes', from: REFUND, to: ISSUE },
  slot('has_state', REFUND, 'orderId', byHuman('primitive|uuid'), '1'),
  slot('has_state', REFUND, 'lines', byAgent(REFUND_LINE), '*'),
  slot('has_state', REFUND, 'notes', byAgent('primitive|string'), '*'),
  slot('has_state', REFUND, 'issuedAt', byAgent('primitive|datetime'), '0..1'),
  input('orderId', byAgent('primitive|uuid'), '1', 1),
  input('lines', byAgent(REFUND_LINE), '*', 2),
  input('reason', byHuman('primitive|string'), '0..1', 3),
  {
    kind: 'has_output',
    from: ISSUE,
    name: 'result',
    to: byAgent(REFUND_ISSUED),
    cardinality: byAgent('1'),
  },
] as const;

/** The relations the design adds that reach elements the model has. */
const relationsToTheModel = [
  {
    kind: 'extends',
    from: REFUND_REPOSITORY,
    to: 'building_block|sales.shared.Repository',
  },
  slot(
    'has_state',
    ORDER,
    'refundedAmount',
    byAgent('building_block|sales.shared.Money'),
    '1',
  ),
  {
    kind: 'behavior_invokes_behavior',
    from: ISSUE,
    to: CANCEL,
    order: byAgent(1),
  },
] as const;

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
        rules: noChanges,
      },
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
        type: byAgent('value_object'),
        definition: byAgent('One order line given back, and how much of it.'),
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
        id: REFUND_REPOSITORY,
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
        id: 'building_block|sales.orders.Order',
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
        rules: noChanges,
        scenarios: noChanges,
      },
    ],
  },
  relations: {
    added: [...relationsWithinTheDesign, ...relationsToTheModel],
    removed: [
      { kind: 'module_contains_module', from: SALES, to: CREDIT_NOTES },
      {
        kind: 'has_state',
        from: ORDER,
        to: 'primitive|uuid',
        name: 'creditNoteId',
      },
      {
        kind: 'has_input',
        from: CANCEL,
        to: 'primitive|boolean',
        name: 'force',
      },
      {
        kind: 'behavior_invokes_behavior',
        from: CANCEL,
        to: 'behavior|sales.credit-notes.CreditNote.issue',
      },
    ],
    modified: [
      {
        kind: 'has_state',
        from: ORDER,
        name: 'status',
        to: byAgent('building_block|sales.orders.OrderStatus'),
        cardinality: unchanged,
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
        name: 'result',
        to: byAgent('building_block|sales.orders.OrderCancelled'),
        cardinality: unchanged,
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
  relations: {
    added: [...byAgentOnly.relations.added].slice(
      0,
      relationsWithinTheDesign.length,
    ),
  },
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
  relations: { added: [...relationsWithinTheDesign] },
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
