import {
  BARE_ROW,
  type OutlineKind,
  type OutlineNode,
  patternLabelOf,
} from '#/features/design-docs/ui/model-tree/model-outline.ts';
import type {
  DesignDocumentInput,
  DesignedNeedInput,
  DesignedRuleInput,
} from '#backend/app/design-docs/design-doc.ts';
import {
  type ChangeSetInput,
  designedOf,
  findById,
  findByName,
  writtenIn,
} from './change-set.ts';
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

export type NeedsInput = ChangeSetInput<DesignedNeedInput, string> | undefined;

/**
 * The counts a reviewer reads first, in the order they are read, each with
 * its word. A `gap` is a count that should be zero: above it, it is marked.
 */
export const REQUIREMENTS_SUMMARY: readonly {
  key: keyof RequirementsSummary;
  one: string;
  many: string;
  gap: boolean;
}[] = [
  { key: 'needs', one: 'need', many: 'needs', gap: false },
  { key: 'rules', one: 'rule', many: 'rules', gap: false },
  {
    key: 'designDecisions',
    one: 'design decision',
    many: 'design decisions',
    gap: false,
  },
  {
    key: 'unaddressedNeeds',
    one: 'unaddressed need',
    many: 'unaddressed needs',
    gap: true,
  },
  {
    key: 'rulesWithoutVerification',
    one: 'rule without verification',
    many: 'rules without verification',
    gap: true,
  },
];

/** What a rule that answers no need is: a decision of the design's own. */
export const DESIGN_DECISION = 'Design decision';

/** Why a rule is a design decision, said beside the word. */
export const DESIGN_DECISION_REASON = 'no need asks for it';

/** The needs a rule answers in words; a rule that answers none is the design's own decision. */
export const tracedTo = (needs: string[]): string =>
  needs.length === 0 ? DESIGN_DECISION : `Answers ${needs.join(', ')}`;

/** A rule's category and type in one phrase, `Quality · Performance`. */
export const classificationOf = (rule: DesignedRuleInput): string | null => {
  const words = [valueOf(rule.category), valueOf(rule.ruleType)].filter(
    (word) => word !== null,
  );
  return words.length > 0 ? words.join(' · ') : null;
};

/** What a rule can be on, in words: the kind of element it constrains. */
export const RULE_PLACE_KIND: Partial<Record<OutlineKind, string>> = {
  module: 'module',
  building_block: 'building block',
  behaviour: 'behaviour',
};

/**
 * A modified rule the design changes more than the statement of: its
 * classification, its rationale or the needs it answers. Its details are
 * marked changed, so the reader opens them.
 */
export const changesDetails = (traced: TracedRule): boolean =>
  traced.change === 'modified' &&
  (classificationOf(traced.rule) !== null ||
    valueOf(traced.rule.rationale) !== null ||
    traced.trace !== null);

/**
 * Whether a rule's trace is worth a line: it answers some need, or the design
 * empties it — a trace taken away is a change too, and reads as one.
 */
export const showsTrace = (traced: TracedRule): boolean =>
  (traced.trace ?? []).length > 0 ||
  (traced.change === 'modified' && traced.trace !== null);

/** A need by its name, one the design leaves unnamed by its id. */
export const needNameOf = (need: DesignedNeedInput): string =>
  valueOf(need.name) ?? need.id;

/** Needs by their names, a need the document does not state by its id. */
export const needNamesOf = (ids: string[], needs: NeedsInput): string[] =>
  ids.map((id) => {
    const need = findById(needs, id);
    return need === null ? id : needNameOf(need);
  });

export function requirementsOf(
  document: DesignDocumentInput,
  /** The document's outline, when the caller already holds it. */
  outline: readonly OutlineNode[] = outlineOf(document),
): RequirementsOutline {
  const needs = writtenIn(document.needs);
  const rules = [...tracedRules(document, outline)];
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
  traced.change === 'added' && writtenIn(traced.rule.scenarios).length === 0;

/** Every rule the design touches, in the order the model view's outline lists them. */
function* tracedRules(
  document: DesignDocumentInput,
  outline: readonly OutlineNode[],
): Generator<TracedRule> {
  const byPath = new Map(outline.map((node) => [node.path, node]));

  for (const node of outline) {
    if (node.kind !== 'rule' || node.parentPath === null) continue;
    const owner = byPath.get(node.parentPath);
    if (owner === undefined) continue;
    const place = placeOf(node.name, owner, byPath);
    if (node.change === 'removed') {
      yield { ...place, change: 'removed', rule: null, trace: null };
      continue;
    }
    const rule = findByName(designedOf(document, owner.path)?.rules, node.name);
    if (rule === null) continue;
    const traced = valueOf(rule.needs);
    yield {
      ...place,
      change: node.change === 'added' ? 'added' : 'modified',
      rule,
      trace: traced === null ? null : needNamesOf(traced, document.needs),
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

/*
 * The same document as a tree beside it: each need with the rules that answer
 * it, then the two groups the document closes on. A rule two needs share is a
 * row under each, so a row's path is where it sits, not what it is — the
 * document marks each entry with the same path, which is how a row finds it.
 */

export const DESIGN_DECISIONS_PATH = 'decisions';
export const UNADDRESSED_NEEDS_PATH = 'unaddressed';

/** The two groups the document closes on, as both the tree and the page name them. */
export const DESIGN_DECISIONS_TITLE = 'Design decisions';
export const UNADDRESSED_NEEDS_TITLE = 'Unaddressed needs';

/** What the requirements tree says when the design states nothing to put in it. */
export const NO_REQUIREMENTS = 'This design states no needs or rules yet.';

/** A need's row, in whichever tree draws one: at the top, or under the group that holds it. */
export const needPath = (needId: string, under?: string): string =>
  under === undefined ? `need:${needId}` : `${under}/need:${needId}`;

/** A need's row, wherever one is drawn; `added` holds the needs the design adds. */
export const needRow = (
  need: DesignedNeedInput,
  added: ReadonlySet<string>,
  under?: string,
): OutlineNode => ({
  ...BARE_ROW,
  path: needPath(need.id, under),
  parentPath: under ?? null,
  kind: 'need',
  name: needNameOf(need),
  depth: under === undefined ? 0 : 1,
  change: added.has(need.id) ? 'added' : 'modified',
});

export const rulePath = (traced: TracedRule, under: string): string =>
  `${under}/rule:${traced.element.id}:${traced.name}`;

export function requirementsTreeOf(
  requirements: RequirementsOutline,
  document: DesignDocumentInput,
): OutlineNode[] {
  const added = new Set(document.needs?.added?.map(({ id }) => id));
  const nodes: OutlineNode[] = [];
  const needNode = (need: DesignedNeedInput, under?: string) => {
    nodes.push(needRow(need, added, under));
  };
  const ruleNode = (traced: TracedRule, under: string) => {
    const pattern = traced.rule === null ? null : valueOf(traced.rule.ruleType);
    nodes.push({
      ...BARE_ROW,
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
    nodes.push({ ...BARE_ROW, path, parentPath: null, kind: 'group', name });
  };

  for (const { need, rules } of requirements.needs) {
    needNode(need);
    for (const traced of rules) ruleNode(traced, needPath(need.id));
  }
  groupNode(DESIGN_DECISIONS_PATH, DESIGN_DECISIONS_TITLE);
  for (const traced of requirements.designDecisions)
    ruleNode(traced, DESIGN_DECISIONS_PATH);
  groupNode(UNADDRESSED_NEEDS_PATH, UNADDRESSED_NEEDS_TITLE);
  for (const need of requirements.unaddressedNeeds)
    needNode(need, UNADDRESSED_NEEDS_PATH);
  return nodes;
}
