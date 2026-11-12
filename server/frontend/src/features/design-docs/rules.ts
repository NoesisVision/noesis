import { moduleOf, nameOf, parentOf } from '#/shared/model/element-id.ts';
import { modelWordOf } from '#/shared/ui/title-case.ts';
import type {
  DesignDocumentInput,
  DesignedRuleInput,
  DesignedScenarioInput,
} from '#backend/app/design-docs/design-doc.ts';
import type { RuleKind } from '#backend/app/system-model/system-model.ts';
import type { ChangeSetInput } from './change-set.ts';
import { type DesignDocFieldInput, valueOf } from './design-doc-field.ts';
import { GOVERNING_KINDS } from './relations.ts';

/** The kinds a rule may be, as the model spells them. */
export const RULE_KINDS = [
  'validation',
  'state_change',
  'post',
  'computation',
  'coordination',
  'configuration',
] as const satisfies readonly RuleKind[];

/*
 * Where a design's rules and scenarios are read. A rule is an element of its
 * own, attached to the behaviors that follow it by `behavior_governs_rule`
 * relations and to the manual processes that keep it by hand by
 * `process_governs_rule` relations; it is shown under each of them. A rule the design names no behavior for — one
 * the model has, whose governors the design leaves alone — is shown under
 * the module its id names. A scenario is shown under the rule its id names.
 */

export type RuleSet = ChangeSetInput<DesignedRuleInput, string>;
export type ScenarioSet = ChangeSetInput<DesignedScenarioInput, string>;

/** The behaviors and manual processes the design says follow a rule, in the order it writes them. */
export function governorsOf(
  doc: DesignDocumentInput,
  ruleId: string,
): string[] {
  const relations = doc.relations;
  const governing = [
    ...(relations?.added ?? []),
    ...(relations?.removed ?? []),
  ].flatMap((relation) =>
    GOVERNING_KINDS.has(relation.kind) && relation.to === ruleId
      ? [relation.from]
      : [],
  );
  return [...new Set(governing)];
}

/** The elements a rule is shown under: its governors, or else its module. */
export function placesOf(doc: DesignDocumentInput, ruleId: string): string[] {
  const governors = governorsOf(doc, ruleId);
  return governors.length > 0 ? governors : [moduleOf(ruleId)];
}

/** The rules the design shows under an element, as a change set of their own. */
export function rulesUnder(
  doc: DesignDocumentInput,
  elementId: string,
): RuleSet {
  const here = (id: string) => placesOf(doc, id).includes(elementId);
  return {
    added: doc.rules?.added?.filter(({ id }) => here(id)),
    modified: doc.rules?.modified?.filter(({ id }) => here(id)),
    removed: doc.rules?.removed?.filter(here),
  };
}

/** A rule's scenarios: those whose id names it. */
export function scenariosUnder(
  doc: DesignDocumentInput,
  ruleId: string,
): ScenarioSet {
  const here = (id: string) => parentOf(id) === ruleId;
  return {
    added: doc.scenarios?.added?.filter(({ id }) => here(id)),
    modified: doc.scenarios?.modified?.filter(({ id }) => here(id)),
    removed: doc.scenarios?.removed?.filter(here),
  };
}

/**
 * Every rule the design names: those it writes, and those a scenario it
 * writes or removes belongs to, which it otherwise leaves alone.
 */
export function rulesNamedIn(doc: DesignDocumentInput): string[] {
  const ids = new Set<string>([
    ...(doc.rules?.added ?? []).map(({ id }) => id),
    ...(doc.rules?.modified ?? []).map(({ id }) => id),
    ...(doc.rules?.removed ?? []),
  ]);
  for (const id of [
    ...(doc.scenarios?.added ?? []).map((scenario) => scenario.id),
    ...(doc.scenarios?.modified ?? []).map((scenario) => scenario.id),
    ...(doc.scenarios?.removed ?? []),
  ]) {
    const rule = parentOf(id);
    if (rule !== null) ids.add(rule);
  }
  return [...ids];
}

/** What a rule or a scenario is called: its name as the design writes it, else the one its id says. */
export const ruleNameOf = (unit: {
  id: string;
  name?: DesignDocFieldInput<string>;
}): string => valueOf(unit.name) ?? nameOf(unit.id);

/** A rule's kind as a reader reads it: `State change`, never `state_change`. */
export const ruleKindLabelOf = (kind: string | null): string | null =>
  kind === null ? null : modelWordOf(kind);
