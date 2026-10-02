import type { OutlineNode } from '#/shared/ui/model-tree/model-outline.ts';
import type {
  DesignDocumentInput,
  DesignedRuleInput,
  DesignedScenarioInput,
} from '#backend/app/design-docs/design-doc.ts';
import { ownerOfPart } from '../../../design-doc-outline.ts';
import { findById, findByName, type ChangeSetInput } from '../change-set.ts';

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

const entriesOf = (set: ScenarioSet | undefined, rule?: string) => {
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
  [...(rules?.added ?? []), ...(rules?.modified ?? [])].flatMap((rule) =>
    entriesOf(rule.scenarios, rule.name),
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
    const owner = ownerOf(doc, node.elementId);
    if (owner === null) return [];
    const own = entriesOf(
      (
        findById(doc.buildingBlocks, node.elementId) ??
        findById(doc.behaviours, node.elementId)
      )?.scenarios,
    ).sort((a, b) => a.name.localeCompare(b.name));
    return [...own, ...ruleEntriesOf(owner.rules)];
  }
  if (node.kind !== 'rule' || node.parentPath === null) return [];
  const { elementId } = ownerOfPart(node.parentPath);
  const rule = findByName(ownerOf(doc, elementId)?.rules, node.name);
  return rule === null ? [] : entriesOf(rule.scenarios);
};

/** The element that keeps rules: a building block, a behaviour or a module. */
const ownerOf = (doc: DesignDocumentInput, id: string) =>
  findById(doc.buildingBlocks, id) ??
  findById(doc.behaviours, id) ??
  findById(doc.modules, id);
