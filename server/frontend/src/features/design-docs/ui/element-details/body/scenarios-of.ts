import type { OutlineNode } from '#/shared/ui/model-tree/model-outline.ts';
import type {
  DesignDocumentInput,
  DesignedRuleInput,
  DesignedScenarioInput,
} from '#backend/app/design-docs/design-doc.ts';
import {
  type ChangeSetInput,
  designedOf,
  findById,
  findByName,
  writtenIn,
} from '../../../change-set.ts';
import { ownerOfPart } from '../../../design-doc-outline.ts';

/** One scenario as the column folds it: what the design does to it, and the rule it belongs to, if any. */
export type ScenarioEntry =
  | {
      change: 'added' | 'modified';
      name: string;
      rule?: string;
      scenario: DesignedScenarioInput;
    }
  | { change: 'removed'; name: string; rule?: string; scenario: null };

type ScenarioSet = ChangeSetInput<DesignedScenarioInput, string>;

/** A set of scenarios as the column folds it: added, then modified, then removed. */
export const scenarioEntriesOf = (
  set: ScenarioSet | undefined,
  rule?: string,
): ScenarioEntry[] => {
  const of = rule === undefined ? {} : { rule };
  return [
    ...(set?.added ?? []).map((scenario): ScenarioEntry => ({
      change: 'added',
      name: scenario.name,
      scenario,
      ...of,
    })),
    ...(set?.modified ?? []).map((scenario): ScenarioEntry => ({
      change: 'modified',
      name: scenario.name,
      scenario,
      ...of,
    })),
    ...(set?.removed ?? []).map((name): ScenarioEntry => ({
      change: 'removed',
      name,
      scenario: null,
      ...of,
    })),
  ];
};

/** A rule's own scenarios — of the rules the design writes out. */
const ruleEntriesOf = (
  rules: ChangeSetInput<DesignedRuleInput, string> | undefined,
) =>
  writtenIn(rules).flatMap((rule) =>
    scenarioEntriesOf(rule.scenarios, rule.name),
  );

/**
 * The scenarios the design gives an element — a block's or a behaviour's own,
 * then its rules', a module's rules' alone — or a rule's own; none for anything else, and none for an
 * element the design removes.
 */
export const scenariosOf = (
  node: OutlineNode,
  doc: DesignDocumentInput,
): ScenarioEntry[] => {
  if (node.change === 'removed') return [];
  if (node.elementId !== null) {
    const owner = designedOf(doc, node.elementId);
    if (owner === null) return [];
    const own = scenarioEntriesOf(
      (
        findById(doc.buildingBlocks, node.elementId) ??
        findById(doc.behaviours, node.elementId)
      )?.scenarios,
    ).sort((a, b) => a.name.localeCompare(b.name));
    return [...own, ...ruleEntriesOf(owner.rules)];
  }
  if (node.kind !== 'rule' || node.parentPath === null) return [];
  const { elementId } = ownerOfPart(node.parentPath);
  const rule = findByName(designedOf(doc, elementId)?.rules, node.name);
  return rule === null ? [] : scenarioEntriesOf(rule.scenarios);
};
