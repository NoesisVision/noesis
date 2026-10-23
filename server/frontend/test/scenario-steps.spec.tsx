import { describe, expect, it } from 'bun:test';
import { renderToStaticMarkup } from 'react-dom/server';
import type { ScenarioStep } from '#backend/app/scanner/system-model/system-model.ts';
import {
  keywordOf,
  nextKindAfter,
} from '../src/features/design-docs/scenario-steps';
import { ScenarioSteps } from '../src/features/design-docs/ui/element-details/body/sections/scenario-steps-section';
import { MantineProvider } from '../src/shared/design-system/provider';

const steps: ScenarioStep[] = [
  { kind: 'given', text: 'a paid order' },
  { kind: 'given', text: 'a voucher' },
  { kind: 'when', text: 'it is refunded' },
  { kind: 'then', text: 'the voucher is void' },
  { kind: 'when', text: 'it is refunded again' },
];

describe('the steps of a scenario', () => {
  it('read each kind by its keyword, and one going on with it by "And"', () => {
    expect(steps.map((_, index) => keywordOf(steps, index))).toEqual([
      'Given',
      'And',
      'When',
      'Then',
      'When',
    ]);
  });

  it('suggest the kind that comes next: Given, When, Then, and Then again', () => {
    expect(nextKindAfter([])).toBe('given');
    expect(nextKindAfter(steps.slice(0, 2))).toBe('when');
    expect(nextKindAfter(steps.slice(0, 3))).toBe('then');
    expect(nextKindAfter(steps.slice(0, 4))).toBe('then');
  });

  it('are shown in order, under their keywords', () => {
    const html = renderToStaticMarkup(
      <MantineProvider>
        <ScenarioSteps
          scenario={{ name: 'Refunding', steps: { value: steps } }}
        />
      </MantineProvider>,
    );
    const keywords = [...html.matchAll(/<dt[^>]*>([A-Za-z]+)<\/dt>/g)].map(
      (match) => match[1],
    );
    expect(keywords).toEqual(['Given', 'And', 'When', 'Then', 'When']);
    expect(html.indexOf('a voucher')).toBeLessThan(
      html.indexOf('it is refunded'),
    );
  });

  it('say so when the design leaves them as the model has them', () => {
    const html = renderToStaticMarkup(
      <MantineProvider>
        <ScenarioSteps
          scenario={{ name: 'Refunding', steps: { changed: false } }}
        />
      </MantineProvider>,
    );
    expect(html).toContain('unchanged');
  });
});
