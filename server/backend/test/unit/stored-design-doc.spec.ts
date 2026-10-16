import { describe, expect, it } from 'bun:test';
import { DesignDocument } from '#backend/app/design-docs/design-doc';
import { StoredDesignDocument } from '#backend/app/design-docs/stored-design-doc';

const byAgent = <T>(value: T) => ({ value, author: 'agent' as const });
const byHuman = <T>(value: T) => ({ value, author: 'human' as const });

/** A stored document with one rule on one module, holding the given scenario. */
const storedWith = (scenario: Record<string, unknown>) => ({
  id: '2026-10-14-refunds',
  name: 'Refunds',
  description: 'A design.',
  modules: {
    added: [
      {
        id: 'module|sales',
        name: byAgent('sales'),
        rules: {
          added: [
            {
              name: 'Refunds are bounded',
              category: byAgent('Quality'),
              ruleType: byAgent('Reliability'),
              scenarios: { added: [scenario] },
            },
          ],
        },
      },
    ],
  },
  implemented: false,
});

const scenarioOf = (document: DesignDocument) => {
  const rule = document.modules.added[0]!.rules.added[0]!;
  return rule.scenarios.added[0]!;
};

describe('A stored design document', () => {
  it('reads a scenario with steps as it is', () => {
    const steps = byAgent([
      { kind: 'then' as const, text: 'the refund is issued' },
      { kind: 'then' as const, text: 'the customer is told' },
    ]);
    const read = StoredDesignDocument.parse(
      storedWith({ name: 'Two outcomes', steps }),
    );
    expect(scenarioOf(read).steps).toEqual({ changed: true, ...steps });
  });

  it('reads a scenario written with one given, when and then as its steps', () => {
    const read = StoredDesignDocument.parse(
      storedWith({
        name: 'Refunding a line',
        given: byHuman('a paid order'),
        when: byAgent('support refunds a line'),
        // oxlint-disable-next-line unicorn/no-thenable
        then: byHuman('the line is refunded'), // NOSONAR
      }),
    );
    expect(scenarioOf(read).steps).toEqual({
      changed: true,
      value: [
        { kind: 'given', text: 'a paid order' },
        { kind: 'when', text: 'support refunds a line' },
        { kind: 'then', text: 'the line is refunded' },
      ],
      // Not every step was a human's.
      author: 'agent',
    });
  });

  it('leaves out an old step that says nothing', () => {
    const read = StoredDesignDocument.parse(
      storedWith({
        name: 'Refunding a line',
        given: byHuman(''),
        when: byHuman('support refunds a line'),
        // oxlint-disable-next-line unicorn/no-thenable
        then: byHuman('the line is refunded'), // NOSONAR
      }),
    );
    expect(scenarioOf(read).steps).toMatchObject({
      value: [
        { kind: 'when', text: 'support refunds a line' },
        { kind: 'then', text: 'the line is refunded' },
      ],
      author: 'human',
    });
  });

  it('keeps old steps the design leaves alone as unchanged', () => {
    const read = StoredDesignDocument.parse(
      storedWith({
        name: 'Refunding a line',
        given: { changed: false },
        when: { changed: false },
        // oxlint-disable-next-line unicorn/no-thenable
        then: { changed: false }, // NOSONAR
      }),
    );
    expect(scenarioOf(read).steps).toEqual({ changed: false });
  });

  it('refuses old steps written only in part, which would lose the rest', () => {
    const parsed = StoredDesignDocument.safeParse(
      storedWith({
        name: 'Refunding a line',
        // oxlint-disable-next-line unicorn/no-thenable
        then: byAgent('the line is refunded'), // NOSONAR
      }),
    );
    expect(parsed.success).toBe(false);
  });

  it('is written back with its steps', () => {
    const read = StoredDesignDocument.parse(
      storedWith({
        name: 'Refunding a line',
        given: byAgent('a paid order'),
        when: byAgent('support refunds a line'),
        // oxlint-disable-next-line unicorn/no-thenable
        then: byAgent('the line is refunded'), // NOSONAR
      }),
    );
    const written = StoredDesignDocument.encode(read) as DesignDocument;
    expect(scenarioOf(written)).not.toHaveProperty('given');
    expect(scenarioOf(DesignDocument.parse(written)).steps).toMatchObject({
      value: [{ kind: 'given' }, { kind: 'when' }, { kind: 'then' }],
    });
  });
});

describe('The steps of a scenario', () => {
  it('may repeat a kind or leave one out, but are never none', () => {
    const scenario = (steps: unknown[]) =>
      DesignDocument.safeParse(
        storedWith({ name: 'Refunding a line', steps: byAgent(steps) }),
      ).success;
    expect(
      scenario([
        { kind: 'given', text: 'a paid order' },
        { kind: 'given', text: 'a voucher' },
        { kind: 'then', text: 'the voucher is void' },
      ]),
    ).toBe(true);
    expect(scenario([{ kind: 'then', text: 'nothing happens' }])).toBe(true);
    expect(scenario([])).toBe(false);
    expect(scenario([{ kind: 'and', text: 'a voucher' }])).toBe(false);
  });
});
