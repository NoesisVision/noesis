import type { DesignDocumentInput } from '#backend/app/design-docs/design-doc.ts';

/*
 * A design read as requirements: a need two rules answer, a need one rule
 * shares with it, a need nothing answers, a rule on a module, a rule with no
 * scenario, a rule no need asks for, and a rule the design modifies — its
 * trace changed — and one it removes, both on an element only the model has.
 */

const agent = <const T>(value: T) => ({ value, author: 'agent' as const });

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
      {
        id: 'module|sales.refunds',
        definition: agent('Giving money back.'),
        rules: {
          added: [
            {
              name: 'A refund is issued within a second',
              category: agent('Quality'),
              ruleType: agent('Performance'),
              description: agent('Issuing a refund answers within a second.'),
              needs: agent(['refund-single-lines']),
            },
          ],
        },
      },
    ],
  },
  buildingBlocks: {
    added: [
      {
        id: 'building_block|sales.refunds.Refund',
        type: agent('aggregate'),
        definition: agent('A refund of one or more lines of an order.'),
        rules: {
          added: [
            {
              name: 'Refund never exceeds paid amount',
              category: agent('Business'),
              ruleType: agent('Consistency'),
              description: agent('A refund gives back at most what was paid.'),
              needs: agent(['refund-single-lines', 'see-what-was-refunded']),
              rationale: agent('Support never pays out more than came in.'),
              scenarios: {
                added: [
                  {
                    name: 'Refunding more than was paid',
                    given: agent('an order paid 100'),
                    when: agent('support refunds 120'),
                    // Gherkin's word; the fixture is never awaited.
                    // oxlint-disable-next-line unicorn/no-thenable
                    then: agent('the refund is refused'), // NOSONAR
                  },
                ],
              },
            },
          ],
        },
      },
    ],
    modified: [
      {
        id: 'building_block|sales.orders.Order',
        rules: {
          modified: [
            {
              name: 'Order total counts refunds',
              description: agent('An order total subtracts what was refunded.'),
              needs: agent(['see-what-was-refunded']),
            },
          ],
          removed: ['Paid orders are final'],
        },
      },
    ],
  },
  behaviours: {
    added: [
      {
        id: 'behavior|sales.refunds.Refund.issue',
        type: agent('Command'),
        definition: agent('How a refund is issued.'),
        rules: {
          added: [
            {
              name: 'Only paid orders are refundable',
              category: agent('Business'),
              ruleType: agent('State change'),
              description: agent('A refund is issued against a paid order.'),
              needs: agent([]),
              scenarios: {
                added: [
                  {
                    name: 'Refunding an unpaid order',
                    given: agent('an order not yet paid'),
                    when: agent('support refunds a line'),
                    // oxlint-disable-next-line unicorn/no-thenable
                    then: agent('the refund is refused'), // NOSONAR
                  },
                ],
              },
            },
          ],
        },
      },
    ],
  },
} satisfies DesignDocumentInput;
