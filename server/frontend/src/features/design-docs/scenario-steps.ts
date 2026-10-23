import type {
  ScenarioStep,
  ScenarioStepKind,
} from '#backend/app/scanner/system-model/system-model.ts';

/*
 * A scenario's steps as they are read: each kind under its keyword, and a
 * step that goes on with the kind before it under "And", as Gherkin reads.
 */

export const STEP_KINDS: readonly ScenarioStepKind[] = [
  'given',
  'when',
  'then',
];

export const STEP_KEYWORD: Record<ScenarioStepKind, string> = {
  given: 'Given',
  when: 'When',
  // oxlint-disable-next-line unicorn/no-thenable
  then: 'Then', // NOSONAR
};

/** The keyword a step reads under: its kind's, or "And" after a step of that kind. */
export const keywordOf = (
  steps: readonly ScenarioStep[],
  index: number,
): string => {
  const kind = steps[index]!.kind;
  return index > 0 && steps[index - 1]!.kind === kind
    ? 'And'
    : STEP_KEYWORD[kind];
};

/**
 * The kind a step added after these most likely is: the one that follows the
 * last, a scenario going Given, When, Then; after a Then, another Then.
 */
export const nextKindAfter = (
  steps: readonly ScenarioStep[],
): ScenarioStepKind => {
  const last = steps.at(-1)?.kind;
  if (last === undefined) return 'given';
  return STEP_KINDS[Math.min(STEP_KINDS.indexOf(last) + 1, 2)]!;
};
