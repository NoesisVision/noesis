import { describe, expect, it } from 'bun:test';
import {
  focusRule,
  scenariosOfRule,
} from '../src/features/design-docs/ui/element-details/body/scenario-focus';
import type { ScenarioEntry } from '../src/features/design-docs/ui/element-details/body/scenarios-of';

const removed = (name: string, rule?: string): ScenarioEntry => ({
  change: 'removed',
  name,
  scenario: null,
  ...(rule === undefined ? {} : { rule }),
});

const column = [
  removed('The element’s own'),
  removed('An unpaid hold lapses', 'A hold expires'),
  removed('A paid hold stays', 'A hold expires'),
  removed('A second card is refused', 'Only once'),
];

describe('scenariosOfRule', () => {
  it("opens a rule's own scenarios, by their place in the column", () => {
    expect(scenariosOfRule(column, 'A hold expires')).toEqual(['1', '2']);
    expect(scenariosOfRule(column, 'Only once')).toEqual(['3']);
  });

  it('opens nothing for a rule with no scenarios in the column', () => {
    expect(scenariosOfRule(column, 'Never written')).toEqual([]);
  });
});

describe('focusRule', () => {
  it("opens a rule's scenarios and makes it the one that stands out", () => {
    expect(focusRule(column, null, 'A hold expires')).toEqual({
      rule: 'A hold expires',
      open: ['1', '2'],
    });
  });

  it('moves from one rule to another', () => {
    expect(focusRule(column, 'A hold expires', 'Only once')).toEqual({
      rule: 'Only once',
      open: ['3'],
    });
  });

  it('lets go when the same rule is asked again, folding every scenario', () => {
    expect(focusRule(column, 'A hold expires', 'A hold expires')).toEqual({
      rule: null,
      open: [],
    });
  });
});
