import {
  drawsDiagram,
  inReadingOrder,
  type OutlineChange,
  type OutlineKind,
  type OutlineNode,
  patternLabelOf,
} from '#/features/design-docs/ui/model-tree/model-outline.ts';
import type {
  DesignDocumentInput,
  DesignedBehaviorInput,
  DesignedBuildingBlockInput,
  DesignedDomainModuleInput,
} from '#backend/app/design-docs/design-doc.ts';
import { type ChangeSetInput, named } from './change-set.ts';
import {
  type DesignDocFieldInput,
  slotLabelOf,
  valueOf,
} from './design-doc-field.ts';
import { kindOf, nameOf, parentOf } from './element-id.ts';
import {
  placesOf,
  ruleKindLabelOf,
  ruleNameOf,
  rulesNamedIn,
  scenariosUnder,
} from './rules.ts';

/*
 * The other half of the design document's own sentence: the hierarchy is
 * rebuilt from the ids when a reader wants it. The document says what changes
 * and nothing about what contains what, so every relation here is read back
 * out of the ids, and an ancestor the document never mentions is conjured
 * unchanged rather than left as a hole under one of its descendants.
 *
 * The document is read as the wire carries it — ids are plain strings, and a
 * field the writer left out is absent rather than defaulted.
 *
 * A rule is no part of what its id names: it hangs under each behavior that
 * governs it (rules.ts), its scenarios under it.
 */

export function outlineOf(document: DesignDocumentInput): OutlineNode[] {
  const nodes = new Map<string, OutlineNode>();
  addModules(nodes, document.modules);
  addBuildingBlocks(nodes, document.buildingBlocks);
  addBehaviors(nodes, document.behaviors);
  addRules(nodes, document);
  addProperties(nodes, document.relations);
  addImpliedAncestors(nodes);
  return inReadingOrder(nodes.values());
}

function addModules(
  nodes: Map<string, OutlineNode>,
  modules: ChangeSetInput<DesignedDomainModuleInput, string> | undefined,
): void {
  for (const [module, change] of named(modules)) {
    put(nodes, element(module.id, change, null, isDrawn(module)));
  }
  for (const id of modules?.removed ?? []) put(nodes, element(id, 'removed'));
}

function addBuildingBlocks(
  nodes: Map<string, OutlineNode>,
  blocks: ChangeSetInput<DesignedBuildingBlockInput, string> | undefined,
): void {
  for (const [block, change] of named(blocks)) {
    put(nodes, element(block.id, change, valueOf(block.type), isDrawn(block)));
  }
  for (const id of blocks?.removed ?? []) put(nodes, element(id, 'removed'));
}

function addBehaviors(
  nodes: Map<string, OutlineNode>,
  behaviors: ChangeSetInput<DesignedBehaviorInput, string> | undefined,
): void {
  for (const [behavior, change] of named(behaviors)) {
    put(nodes, element(behavior.id, change, null, isDrawn(behavior)));
  }
  for (const id of behaviors?.removed ?? []) put(nodes, element(id, 'removed'));
}

/**
 * A block's state hangs under it as its properties, and what it works with
 * as its collaborators: the `has_state` and `has_collaborator` relations from
 * it, wherever the document writes them — under a block it names, or from
 * one it leaves alone, which is then implied like any ancestor.
 */
function addProperties(
  nodes: Map<string, OutlineNode>,
  relations: DesignDocumentInput['relations'],
): void {
  for (const [relation, change] of named(relations)) {
    if (relation.kind === 'has_state') {
      const type = valueOf(relation.to);
      put(
        nodes,
        part(
          relation.from,
          'property',
          relation.name,
          change,
          type === null
            ? null
            : slotLabelOf(type, valueOf(relation.cardinality)),
        ),
      );
    } else if (relation.kind === 'has_collaborator') {
      const type = valueOf(relation.to);
      put(
        nodes,
        part(
          relation.from,
          'collaborator',
          relation.name,
          change,
          type === null ? null : slotLabelOf(type, null),
        ),
      );
    }
  }
  for (const key of relations?.removed ?? []) {
    if (key.kind === 'has_state')
      put(nodes, part(key.from, 'property', key.name, 'removed'));
    else if (key.kind === 'has_collaborator')
      put(nodes, part(key.from, 'collaborator', key.name, 'removed'));
  }
}

/**
 * Every rule the design names, under each element it is shown at, its
 * scenarios under it; a rule only a scenario names is there unchanged.
 */
function addRules(
  nodes: Map<string, OutlineNode>,
  document: DesignDocumentInput,
): void {
  const rules = document.rules;
  const written = new Map(
    [...named(rules)].map(([rule, change]) => [rule.id, { rule, change }]),
  );
  const removed = new Set(rules?.removed ?? []);
  for (const id of rulesNamedIn(document)) {
    const found = written.get(id);
    const change: OutlineChange =
      found?.change ?? (removed.has(id) ? 'removed' : 'unchanged');
    for (const place of placesOf(document, id)) {
      const node = part(
        place,
        'rule',
        id,
        change,
        found === undefined ? null : valueOf(found.rule.kind),
        found === undefined ? null : valueOf(found.rule.description),
        found === undefined ? nameOf(id) : ruleNameOf(found.rule),
      );
      put(nodes, node);
      addScenarios(nodes, node.path, document, id);
    }
  }
}

function addScenarios(
  nodes: Map<string, OutlineNode>,
  owner: string,
  document: DesignDocumentInput,
  ruleId: string,
): void {
  const scenarios = scenariosUnder(document, ruleId);
  for (const [scenario, change] of named(scenarios))
    put(
      nodes,
      part(
        owner,
        'scenario',
        scenario.id,
        change,
        null,
        valueOf(scenario.description),
        ruleNameOf(scenario),
      ),
    );
  for (const id of scenarios.removed ?? [])
    put(nodes, part(owner, 'scenario', id, 'removed', null, null, nameOf(id)));
}

/**
 * A module the document never names still has to be there, or the element
 * whose id names it has nowhere to hang. Walking up from each element stops at
 * the first ancestor already present: one the document named is walked up from
 * in its own turn, and one conjured here had its own line completed when it
 * was made. They are gathered apart and merged after, so the walk reads a
 * settled map.
 */
function addImpliedAncestors(nodes: Map<string, OutlineNode>): void {
  const implied = new Map<string, OutlineNode>();
  const present = (path: string) => nodes.has(path) || implied.has(path);

  for (const node of nodes.values()) {
    let { parentPath } = node;
    while (parentPath !== null && !present(parentPath)) {
      const ancestor = element(parentPath, 'unchanged');
      implied.set(ancestor.path, ancestor);
      parentPath = ancestor.parentPath;
    }
  }
  for (const [path, ancestor] of implied) nodes.set(path, ancestor);
}

/** An id named twice keeps its first entry; ancestors are only implied later. */
function put(nodes: Map<string, OutlineNode>, node: OutlineNode): void {
  if (!nodes.has(node.path)) nodes.set(node.path, node);
}

/**
 * An element draws its diagram in a field of its own; a definition written
 * before it had one may still carry the fence.
 */
function isDrawn(designed: {
  definition?: DesignDocFieldInput<string>;
  diagram?: DesignDocFieldInput<string>;
}): boolean {
  return (
    valueOf(designed.diagram) !== null ||
    drawsDiagram(valueOf(designed.definition))
  );
}

function element(
  id: string,
  change: OutlineChange,
  pattern: string | null = null,
  hasDiagram = false,
): OutlineNode {
  return {
    path: id,
    parentPath: parentOf(id),
    elementId: id,
    kind: kindOf(id),
    name: nameOf(id),
    depth: 0,
    change,
    pattern,
    patternLabel: patternLabelOf(pattern),
    hasDiagram,
  };
}

function part(
  owner: string,
  kind: OutlineKind,
  key: string,
  change: OutlineChange,
  pattern: string | null = null,
  description: string | null | undefined = null,
  name: string = key,
): OutlineNode {
  return {
    // A part is named under the element — or, for a rule's scenario, the
    // rule — it is shown under, by its key: a property's name, a rule's or a
    // scenario's id. A rule shown under two behaviors is two rows.
    path: partPathOf(owner, kind, key),
    parentPath: owner,
    elementId: null,
    kind,
    name,
    depth: 0,
    change,
    pattern,
    // A property's pattern is its type, spelled by whoever wrote it —
    // `OrderId`, `RefundLine [0..*]`, `date`; a rule's is its kind.
    patternLabel: kind === 'rule' ? ruleKindLabelOf(pattern) : pattern,
    hasDiagram: drawsDiagram(description),
  };
}

const PART_MARK = '#';
const RULE_MARK = `${PART_MARK}rule:`;

/** Where a part sits in the outline: under its owner, by its kind and key. */
export const partPathOf = (owner: string, kind: OutlineKind, key: string) =>
  `${owner}${PART_MARK}${kind}:${key}`;

/** A part's key, read back off its path: a property's name, a rule's or a scenario's id. */
export const partKeyOf = (node: OutlineNode): string => {
  const mark = `${PART_MARK}${node.kind}:`;
  return node.path.slice(node.path.lastIndexOf(mark) + mark.length);
};

/**
 * What a part hangs under, read back off the path `part` gave its parent: the
 * element it is shown under and, for a scenario, its rule's id.
 */
export function ownerOfPart(parentPath: string): {
  elementId: string;
  rule: string | null;
} {
  const cut = parentPath.indexOf(RULE_MARK);
  if (cut === -1) return { elementId: parentPath, rule: null };
  return {
    elementId: parentPath.slice(0, cut),
    rule: parentPath.slice(cut + RULE_MARK.length),
  };
}
