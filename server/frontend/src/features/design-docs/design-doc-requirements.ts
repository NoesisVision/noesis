import {
  type OutlineKind,
  type OutlineNode,
  patternLabelOf,
} from '#/shared/ui/model-tree/model-outline.ts';
import type {
  DesignDocumentInput,
  DesignedNeedInput,
  DesignedRuleInput,
} from '#backend/app/design-docs/design-doc.ts';
import { valueOf } from './design-doc-field.ts';
import { outlineOf } from './design-doc-outline.ts';

/*
 * The design read as a requirements document: each need, the rules that
 * answer it, the rules no need asks for, and the needs nothing answers. A
 * rule is a requirement — its name the title, its description the statement,
 * its own scenarios the verification — so nothing here is stored: it is the
 * same document laid out another way.
 */

export interface RequirementsOutline {
  needs: { need: DesignedNeedInput; rules: TracedRule[] }[];
  /** Rules no need of this document asks for, removed ones among them. */
  designDecisions: TracedRule[];
  unaddressedNeeds: DesignedNeedInput[];
  summary: RequirementsSummary;
}

export interface RequirementsSummary {
  needs: number;
  rules: number;
  designDecisions: number;
  unaddressedNeeds: number;
  rulesWithoutVerification: number;
}

/** The element a rule is on, and the module that element sits in. */
interface RulePlace {
  name: string;
  element: { id: string; name: string; kind: OutlineKind };
  module: { id: string; name: string };
}

export type TracedRule = RulePlace &
  (
    | {
        change: 'added' | 'modified';
        rule: DesignedRuleInput;
        /** The needs it answers, by name; `null` when the design leaves the trace as it is. */
        trace: string[] | null;
      }
    | { change: 'removed'; rule: null; trace: null }
  );

export function requirementsOf(
  document: DesignDocumentInput,
): RequirementsOutline {
  const needs = [
    ...(document.needs?.added ?? []),
    ...(document.needs?.modified ?? []),
  ];
  const rules = [...tracedRules(document, needs)];
  const answering = (need: DesignedNeedInput) =>
    rules.filter(
      ({ rule }) =>
        rule !== null && (valueOf(rule.needs) ?? []).includes(need.id),
    );
  const stated = new Set(needs.map(({ id }) => id));
  const designDecisions = rules.filter(
    ({ rule }) =>
      rule === null ||
      !(valueOf(rule.needs) ?? []).some((id) => stated.has(id)),
  );
  const byNeed = needs.map((need) => ({ need, rules: answering(need) }));
  const unaddressedNeeds = byNeed
    .filter(({ rules: answered }) => answered.length === 0)
    .map(({ need }) => need);
  const live = rules.filter(({ change }) => change !== 'removed');
  return {
    needs: byNeed,
    designDecisions,
    unaddressedNeeds,
    summary: {
      needs: needs.length,
      rules: live.length,
      designDecisions: designDecisions.filter(
        ({ change }) => change !== 'removed',
      ).length,
      unaddressedNeeds: unaddressedNeeds.length,
      rulesWithoutVerification: live.filter(isUnverified).length,
    },
  };
}

/**
 * A rule the design adds with no scenario of its own. A modified rule that
 * leaves its scenarios alone keeps the ones the model has, which the design
 * does not say, so it is not counted as unverified.
 */
const isUnverified = (traced: TracedRule): boolean =>
  traced.change === 'added' && scenariosOf(traced.rule).length === 0;

/** The scenarios the design writes for a rule: added, then modified. */
const scenariosOf = (rule: DesignedRuleInput) => [
  ...(rule.scenarios?.added ?? []),
  ...(rule.scenarios?.modified ?? []),
];

/** Every rule the design touches, in the order the model view's outline lists them. */
function* tracedRules(
  document: DesignDocumentInput,
  needs: DesignedNeedInput[],
): Generator<TracedRule> {
  const outline = outlineOf(document);
  const byPath = new Map(outline.map((node) => [node.path, node]));
  const nameOfNeed = (id: string) =>
    valueOf(needs.find((need) => need.id === id)?.name) ?? id;

  for (const node of outline) {
    if (node.kind !== 'rule' || node.parentPath === null) continue;
    const owner = byPath.get(node.parentPath);
    if (owner === undefined) continue;
    const place = placeOf(node.name, owner, byPath);
    if (node.change === 'removed') {
      yield { ...place, change: 'removed', rule: null, trace: null };
      continue;
    }
    const rule = ruleOf(document, owner.path, node.name);
    if (rule === null) continue;
    const traced = valueOf(rule.needs);
    yield {
      ...place,
      change: node.change === 'added' ? 'added' : 'modified',
      rule,
      trace: traced === null ? null : traced.map(nameOfNeed),
    };
  }
}

/** The element a rule is on and the module it sits in, as the outline names them. */
function placeOf(
  name: string,
  owner: OutlineNode,
  byPath: Map<string, OutlineNode>,
): RulePlace {
  let module: OutlineNode | undefined = owner;
  while (module !== undefined && module.kind !== 'module')
    module =
      module.parentPath === null ? undefined : byPath.get(module.parentPath);
  return {
    name,
    element: { id: owner.path, name: owner.name, kind: owner.kind },
    module: {
      id: module?.path ?? owner.path,
      name: module?.name ?? owner.name,
    },
  };
}

function ruleOf(
  document: DesignDocumentInput,
  ownerId: string,
  name: string,
): DesignedRuleInput | null {
  const owner = [
    ...(document.modules?.added ?? []),
    ...(document.modules?.modified ?? []),
    ...(document.buildingBlocks?.added ?? []),
    ...(document.buildingBlocks?.modified ?? []),
    ...(document.behaviours?.added ?? []),
    ...(document.behaviours?.modified ?? []),
  ].find(({ id }) => id === ownerId);
  const rules = owner?.rules;
  return (
    [...(rules?.added ?? []), ...(rules?.modified ?? [])].find(
      (rule) => rule.name === name,
    ) ?? null
  );
}

/*
 * The same document as a tree beside it: each need with the rules that answer
 * it, then the two groups the document closes on. A rule two needs share is a
 * row under each, so a row's path is where it sits, not what it is — the
 * document marks each entry with the same path, which is how a row finds it.
 */

export const DESIGN_DECISIONS_PATH = 'decisions';
export const UNADDRESSED_NEEDS_PATH = 'unaddressed';

export const needPath = (need: DesignedNeedInput, under?: string): string =>
  under === undefined ? `need:${need.id}` : `${under}/need:${need.id}`;

export const rulePath = (traced: TracedRule, under: string): string =>
  `${under}/rule:${traced.element.id}:${traced.name}`;

/** What every row of the requirements tree has in common: no element, pattern or diagram of its own. */
const ROW = {
  parentPath: null,
  elementId: null,
  depth: 0,
  change: 'unchanged',
  pattern: null,
  patternLabel: null,
  hasDiagram: false,
} as const satisfies Partial<OutlineNode>;

export function requirementsTreeOf(
  requirements: RequirementsOutline,
  document: DesignDocumentInput,
): OutlineNode[] {
  const added = new Set(document.needs?.added?.map(({ id }) => id));
  const nodes: OutlineNode[] = [];
  const needNode = (need: DesignedNeedInput, under?: string) => {
    nodes.push({
      ...ROW,
      path: needPath(need, under),
      parentPath: under ?? null,
      kind: 'need',
      name: valueOf(need.name) ?? need.id,
      depth: under === undefined ? 0 : 1,
      change: added.has(need.id) ? 'added' : 'modified',
    });
  };
  const ruleNode = (traced: TracedRule, under: string) => {
    const pattern = traced.rule === null ? null : valueOf(traced.rule.ruleType);
    nodes.push({
      ...ROW,
      path: rulePath(traced, under),
      parentPath: under,
      kind: 'rule',
      name: traced.name,
      depth: 1,
      change: traced.change,
      pattern,
      patternLabel: patternLabelOf(pattern),
    });
  };
  const groupNode = (path: string, name: string) => {
    nodes.push({ ...ROW, path, kind: 'group', name });
  };

  for (const { need, rules } of requirements.needs) {
    needNode(need);
    for (const traced of rules) ruleNode(traced, needPath(need));
  }
  groupNode(DESIGN_DECISIONS_PATH, 'Design decisions');
  for (const traced of requirements.designDecisions)
    ruleNode(traced, DESIGN_DECISIONS_PATH);
  groupNode(UNADDRESSED_NEEDS_PATH, 'Unaddressed needs');
  for (const need of requirements.unaddressedNeeds)
    needNode(need, UNADDRESSED_NEEDS_PATH);
  return nodes;
}
