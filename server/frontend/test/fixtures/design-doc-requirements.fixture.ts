import type { DesignDocumentInput } from '#backend/app/design-docs/design-doc.ts';

/*
 * A design read as requirements: a need two rules answer, a need one rule
 * shares with it, a need nothing answers, a rule no behavior of the design
 * governs, which sits under its module, a rule with no scenario, a rule no
 * need asks for, and a rule the design modifies — its trace changed — and
 * one it removes, both governed by behaviors only the model has.
 */

const agent = <const T>(value: T) => ({ value, author: 'agent' as const });

const ISSUE = 'behavior|sales.refunds.Refund.issue';
const NOT_EXCEEDING = 'rule|sales.refunds.Refund never exceeds paid amount';
const PAID_ONLY = 'rule|sales.refunds.Only paid orders are refundable';
const COUNTS_REFUNDS = 'rule|sales.orders.Order total counts refunds';
const FINAL = 'rule|sales.orders.Paid orders are final';

export const requirementsFixture = {
  id: '2026-01-01-partial-refunds',
  name: 'Partial refunds',
  description: 'Refund single order lines.',
  needs: {
    added: [
      {
        id: 'refund-single-lines',
        name: agent('Refund single lines'),
        stakeholder: agent('Support agents'),
        statement: agent('Support agents need to refund one line of an order.'),
      },
      {
        id: 'see-what-was-refunded',
        name: agent('See what was refunded'),
        stakeholder: agent('Customers'),
        statement: agent('Customers need to see what an order gave back.'),
      },
      {
        id: 'audit-refunds',
        name: agent('Audit refunds'),
        stakeholder: agent('Finance'),
        statement: agent('Finance needs every refund on record.'),
      },
    ],
  },
  modules: {
    added: [
      { id: 'module|sales.refunds', definition: agent('Giving money back.') },
    ],
  },
  buildingBlocks: {
    added: [
      {
        id: 'building_block|sales.refunds.Refund',
        type: agent('aggregate'),
        definition: agent('A refund of one or more lines of an order.'),
      },
    ],
  },
  behaviors: {
    added: [
      {
        id: ISSUE,
        definition: agent('How a refund is issued.'),
      },
    ],
  },
  rules: {
    added: [
      {
        id: 'rule|sales.refunds.A refund is issued within a second',
        name: agent('A refund is issued within a second'),
        kind: agent('configuration'),
        description: agent('Issuing a refund answers within a second.'),
        needs: agent(['refund-single-lines']),
      },
      {
        id: NOT_EXCEEDING,
        name: agent('Refund never exceeds paid amount'),
        kind: agent('validation'),
        description: agent('A refund gives back at most what was paid.'),
        needs: agent(['refund-single-lines', 'see-what-was-refunded']),
        rationale: agent('Support never pays out more than came in.'),
      },
      {
        id: PAID_ONLY,
        name: agent('Only paid orders are refundable'),
        kind: agent('state_change'),
        description: agent('A refund is issued against a paid order.'),
        needs: agent([]),
      },
    ],
    modified: [
      {
        id: COUNTS_REFUNDS,
        description: agent('An order total subtracts what was refunded.'),
        needs: agent(['see-what-was-refunded']),
      },
    ],
    removed: [FINAL],
  },
  scenarios: {
    added: [
      {
        id: `scenario|sales.refunds.Refund never exceeds paid amount.Refunding more than was paid`,
        name: agent('Refunding more than was paid'),
        steps: agent([
          { kind: 'given', text: 'an order paid 100' },
          { kind: 'when', text: 'support refunds 120' },
          { kind: 'then', text: 'the refund is refused' },
        ]),
      },
      {
        id: `scenario|sales.refunds.Only paid orders are refundable.Refunding an unpaid order`,
        name: agent('Refunding an unpaid order'),
        steps: agent([
          { kind: 'given', text: 'an order not yet paid' },
          { kind: 'when', text: 'support refunds a line' },
          { kind: 'then', text: 'the refund is refused' },
        ]),
      },
    ],
  },
  relations: {
    added: [
      { kind: 'behavior_governs_rule', from: ISSUE, to: NOT_EXCEEDING },
      { kind: 'behavior_governs_rule', from: ISSUE, to: PAID_ONLY },
      {
        kind: 'behavior_governs_rule',
        from: 'behavior|sales.orders.Order.total',
        to: COUNTS_REFUNDS,
      },
    ],
    removed: [
      {
        kind: 'behavior_governs_rule',
        from: 'behavior|sales.orders.Order.pay',
        to: FINAL,
      },
    ],
  },
} satisfies DesignDocumentInput;
