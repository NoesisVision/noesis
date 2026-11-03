import {
  DesignDocument,
  type DesignDocumentInput,
} from '#backend/app/design-docs/design-doc';

/*
 * The JSON form, with every default spelled out, so that decoding and
 * encoding it again gives back exactly this object. Keeps one of every shape
 * the specs rely on: an element added, modified and removed at every level,
 * a rule and a scenario, a relation of each kind added, modified or removed, unchanged fields and
 * changed fields of both authors, every cardinality, an actor performing a
 * manual process that invokes a behavior.
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

const REFUND_OUTCOME =
  "a refund for that line's amount is issued and the second line stays refundable";

const REFUND = 'building_block|sales.refunds.Refund';
const REFUND_LINE = 'building_block|sales.refunds.RefundLine';
const REFUND_ISSUED = 'building_block|sales.refunds.RefundIssued';
const ISSUE = 'behavior|sales.refunds.Refund.issue';
const ORDER = 'building_block|sales.orders.Order';
const CANCEL = 'behavior|sales.orders.Order.cancel';
const NOT_EXCEEDING = 'rule|sales.refunds.Refund never exceeds paid amount';
const PAID_ONLY = 'rule|sales.refunds.Only paid orders are refundable';
const ONE_LINE = `scenario|sales.refunds.Refund never exceeds paid amount.Refunding one line of a paid order`;
const STAYS_CANCELLED = 'rule|sales.orders.Cancelled orders stay cancelled';
const SUPPORT_AGENT = 'actor|Support agent';
const REFUND_A_RETURN = 'manual_process|Refund a returned order';
const REFUNDS_API = 'deployable_unit|refunds-api';
const SALES_LIBRARY = 'library|MyCompany.Sales';
const DOMAIN_LAYER = 'layer|domain';
const REFUNDS_CLUSTER = 'deployment_container|Refunds cluster';

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
      },
      {
        id: REFUND_LINE,
        name: byAgent('RefundLine'),
        type: byAgent('entity'),
        definition: byAgent('One refunded line of the order.'),
        diagram: unchanged,
      },
      {
        id: REFUND_ISSUED,
        name: byAgent('RefundIssued'),
        type: byAgent('value_object'),
        definition: byAgent('Tells the ledger a refund went out.'),
        diagram: unchanged,
      },
      {
        id: 'building_block|sales.refunds.RefundRepository',
        name: byAgent('RefundRepository'),
        type: byAgent('repository'),
        definition: byAgent('Stores refunds.'),
        diagram: unchanged,
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
      },
    ],
  },
  behaviors: {
    added: [
      {
        id: ISSUE,
        name: byAgent('issue'),
        definition: byAgent(
          'Issues a refund for the chosen lines of an order.',
        ),
        diagram: byAgent(
          'sequenceDiagram\n  Support agent->>Refund: issue(orderId, lines)\n  Refund-->>Support agent: RefundIssued',
        ),
      },
    ],
    removed: ['behavior|sales.credit-notes.CreditNote.issue'],
    modified: [
      {
        id: CANCEL,
        name: unchanged,
        definition: unchanged,
        diagram: unchanged,
      },
    ],
  },
  rules: {
    added: [
      {
        id: NOT_EXCEEDING,
        name: byAgent('Refund never exceeds paid amount'),
        kind: byAgent('validation'),
        description: byHuman(
          'The sum of all refunds of an order is at most what the customer paid for it.',
        ),
        needs: byAgent(['refund-single-lines']),
        rationale: byAgent(
          'Support may not pay out more than the order brought in.',
        ),
      },
      {
        id: PAID_ONLY,
        name: byAgent('Only paid orders are refundable'),
        kind: byAgent('state_change'),
        description: byAgent('An unpaid order has nothing to refund.'),
        needs: byAgent([]),
        rationale: unchanged,
      },
    ],
    removed: ['rule|sales.credit-notes.Credit notes are numbered'],
    modified: [
      {
        id: STAYS_CANCELLED,
        name: unchanged,
        kind: byAgent('post'),
        description: unchanged,
        needs: unchanged,
        rationale: unchanged,
      },
    ],
  },
  scenarios: {
    added: [
      {
        id: ONE_LINE,
        name: byAgent('Refunding one line of a paid order'),
        description: byAgent('The happy path of a partial refund.'),
        steps: byAgent([
          { kind: 'given', text: 'a paid order with two lines' },
          { kind: 'when', text: 'support refunds the first line' },
          { kind: 'then', text: REFUND_OUTCOME },
        ]),
      },
    ],
    removed: [
      `scenario|sales.orders.Cancelled orders stay cancelled.Cancelling twice`,
    ],
    modified: [],
  },
  actors: {
    added: [
      {
        id: SUPPORT_AGENT,
        name: byAgent('Support agent'),
        definition: byHuman('Answers customers who return goods.'),
      },
    ],
    removed: ['actor|Clerk'],
    modified: [],
  },
  manualProcesses: {
    added: [
      {
        id: REFUND_A_RETURN,
        name: byAgent('Refund a returned order'),
        definition: byAgent(
          'The support agent checks the returned lines and refunds them.',
        ),
      },
    ],
    removed: [],
    modified: [],
  },
  deployableUnits: {
    added: [
      {
        id: REFUNDS_API,
        name: byAgent('refunds-api'),
        definition: byAgent('The service that issues refunds.'),
      },
    ],
    removed: [],
    modified: [],
  },
  libraries: {
    added: [
      {
        id: SALES_LIBRARY,
        name: byAgent('MyCompany.Sales'),
        definition: byAgent('The sales domain, shared by the services.'),
      },
    ],
    removed: [],
    modified: [],
  },
  layers: {
    added: [
      {
        id: DOMAIN_LAYER,
        name: byAgent('domain'),
        definition: byAgent('The rules of the business, free of technology.'),
      },
    ],
    removed: [],
    modified: [],
  },
  deploymentContainers: {
    added: [
      {
        id: REFUNDS_CLUSTER,
        name: byAgent('Refunds cluster'),
        definition: byAgent('The Kubernetes cluster the refunds run in.'),
      },
    ],
    removed: [],
    modified: [],
  },
  relations: {
    added: [
      { kind: 'performs', from: SUPPORT_AGENT, to: REFUND_A_RETURN },
      { kind: 'contains', from: REFUNDS_API, to: 'module|sales.refunds' },
      { kind: 'hosts', from: REFUNDS_CLUSTER, to: REFUNDS_API },
      {
        kind: 'invokes',
        from: REFUND_A_RETURN,
        to: ISSUE,
        order: byAgent(1),
      },
      { kind: 'governs', from: ISSUE, to: NOT_EXCEEDING },
      { kind: 'governs', from: ISSUE, to: PAID_ONLY },
      { kind: 'illustrates', from: ONE_LINE, to: NOT_EXCEEDING },
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
        kind: 'governs',
        from: 'behavior|sales.credit-notes.CreditNote.issue',
        to: 'rule|sales.credit-notes.Credit notes are numbered',
      },
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
  rules: { added: byAgentOnly.rules.added },
  scenarios: { added: byAgentOnly.scenarios.added },
  actors: { added: byAgentOnly.actors.added },
  manualProcesses: { added: byAgentOnly.manualProcesses.added },
  deployableUnits: { added: byAgentOnly.deployableUnits.added },
  libraries: { added: byAgentOnly.libraries.added },
  layers: { added: byAgentOnly.layers.added },
  deploymentContainers: { added: byAgentOnly.deploymentContainers.added },
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
  rules: { added: designDocFixture.rules.added },
  scenarios: { added: designDocFixture.scenarios.added },
  actors: { added: designDocFixture.actors.added },
  manualProcesses: { added: designDocFixture.manualProcesses.added },
  deployableUnits: { added: designDocFixture.deployableUnits.added },
  libraries: { added: designDocFixture.libraries.added },
  layers: { added: designDocFixture.layers.added },
  deploymentContainers: { added: designDocFixture.deploymentContainers.added },
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
