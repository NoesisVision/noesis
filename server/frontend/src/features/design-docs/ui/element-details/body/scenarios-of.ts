import type { OutlineNode } from '#/features/design-docs/ui/model-tree/model-outline.ts';
import { nameOf } from '#/shared/model/element-id.ts';
import type {
  DesignDocumentInput,
  DesignedScenarioInput,
} from '#backend/app/design-docs/design-doc.ts';
import { findById, writtenIn } from '../../../change-set.ts';
import { partKeyOf } from '../../../design-doc-outline.ts';
import {
  ruleNameOf,
  rulesUnder,
  type ScenarioSet,
  scenariosUnder,
} from '../../../rules.ts';

/**
 * One scenario as the column folds it: what the design does to it, and the
 * rule it illustrates, by id and by the name a reader knows it by.
 */
export type ScenarioEntry = {
  id: string;
  name: string;
  rule?: string;
  ruleName?: string;
} & (
  | { change: 'added' | 'modified'; scenario: DesignedScenarioInput }
  | { change: 'removed'; scenario: null }
);

/** A set of scenarios as the column folds it: added, then modified, then removed. */
export const scenarioEntriesOf = (
  set: ScenarioSet | undefined,
  rule?: { id: string; name?: string },
): ScenarioEntry[] => {
  const of =
    rule === undefined
      ? {}
      : rule.name === undefined
        ? { rule: rule.id }
        : { rule: rule.id, ruleName: rule.name };
  const named = (scenario: DesignedScenarioInput) => ({
    id: scenario.id,
    name: ruleNameOf(scenario),
    scenario,
    ...of,
  });
  return [
    ...(set?.added ?? []).map((scenario): ScenarioEntry => ({
      change: 'added',
      ...named(scenario),
    })),
    ...(set?.modified ?? []).map((scenario): ScenarioEntry => ({
      change: 'modified',
      ...named(scenario),
    })),
    ...(set?.removed ?? []).map((id): ScenarioEntry => ({
      change: 'removed',
      id,
      name: nameOf(id),
      scenario: null,
      ...of,
    })),
  ];
};

/**
 * The scenarios the design shows for an element: those of the rules shown
 * under it — a behavior's, or a module's for a rule it names no behavior
 * of — each with its rule's name, or a rule's own; none for anything else,
 * and none for an element the design removes.
 */
export const scenariosOf = (
  node: OutlineNode,
  doc: DesignDocumentInput,
): ScenarioEntry[] => {
  if (node.change === 'removed') return [];
  if (node.elementId !== null) {
    const rules = rulesUnder(doc, node.elementId);
    return [
      ...writtenIn(rules).map((rule) => rule.id),
      ...(rules.removed ?? []),
    ].flatMap((id) => {
      const rule = findById(doc.rules, id);
      return scenarioEntriesOf(scenariosUnder(doc, id), {
        id,
        name: rule === null ? nameOf(id) : ruleNameOf(rule),
      });
    });
  }
  if (node.kind !== 'rule') return [];
  const id = partKeyOf(node);
  return scenarioEntriesOf(scenariosUnder(doc, id), { id });
};
