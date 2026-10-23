import { describe, expect, it } from 'bun:test';
import { ruleParts, stepsOf } from '../src/features/design-docs/rule-sections';

describe('ruleParts', () => {
  it('reads a description written in parts, in its order', () => {
    const parts = ruleParts(
      'Trigger: `Of(value)` is invoked. Pre-conditions: `value` is present. Algorithm: 1. Check it. 2. Build it. Post-conditions: it is valid. Edge cases: zero is rejected.',
    );
    expect(parts?.map(({ name }) => name)).toEqual([
      'Trigger',
      'Pre-conditions',
      'Algorithm',
      'Post-conditions',
      'Edge cases',
    ]);
    expect(parts?.[0]?.text).toBe('`Of(value)` is invoked.');
    expect(parts?.[2]?.steps).toEqual(['Check it.', 'Build it.']);
    expect(parts?.[4]?.text).toBe('zero is rejected.');
  });

  it('takes a label however it is spelled', () => {
    expect(
      ruleParts('**Trigger:** a. Preconditions: b.')?.map(({ name }) => name),
    ).toEqual(['Trigger', 'Pre-conditions']);
  });

  it('reads a description that names one part, or opens otherwise, as written', () => {
    expect(ruleParts('Trigger: only this.')).toBeNull();
    expect(ruleParts('A refund never exceeds what was paid.')).toBeNull();
    expect(ruleParts('Note first. Trigger: a. Algorithm: b.')).toBeNull();
  });
});

describe('stepsOf', () => {
  it('splits numbered steps written in a run', () => {
    expect(stepsOf('1. One thing. 2. Another, with 3.5 in it.')).toEqual([
      'One thing.',
      'Another, with 3.5 in it.',
    ]);
  });

  it('leaves text that is not a run of steps as it is', () => {
    expect(stepsOf('Just one sentence.')).toBeNull();
    expect(stepsOf('1. Only one step.')).toBeNull();
  });
});
