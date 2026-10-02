import { describe, expect, it } from 'bun:test';
import { scenariosOfRule } from '../src/features/design-docs/ui/element-details/body/scenario-focus';
import type { ScenarioEntry } from '../src/features/design-docs/ui/element-details/body/scenarios-of';

const removed = (name: string, rule?: string): ScenarioEntry => ({
  change: 'removed',
  name,
  scenario: null,
  ...(rule === undefined ? {} : { rule }),
});

describe('scenariosOfRule', () => {
  const column = [
    removed('The element’s own'),
    removed('An unpaid hold lapses', 'A hold expires'),
    removed('A paid hold stays', 'A hold expires'),
    removed('A second card is refused', 'Only once'),
  ];

  it("opens a rule's own scenarios, by their place in the column", () => {
    expect(scenariosOfRule(column, 'A hold expires')).toEqual(['1', '2']);
    expect(scenariosOfRule(column, 'Only once')).toEqual(['3']);
  });

  it('opens nothing for a rule with no scenarios in the column', () => {
    expect(scenariosOfRule(column, 'Never written')).toEqual([]);
  });
});
