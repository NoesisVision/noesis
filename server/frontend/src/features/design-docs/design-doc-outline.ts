import {
  drawsDiagram,
  inReadingOrder,
  type OutlineChange,
  type OutlineKind,
  type OutlineNode,
  patternLabelOf,
} from '#/shared/ui/model-tree/model-outline.ts';
import type {
  DesignDocumentInput,
  DesignedBehaviourInput,
  DesignedBuildingBlockInput,
  DesignedDomainModuleInput,
  DesignedPropertyInput,
  DesignedRuleInput,
  DesignedScenarioInput,
} from '#backend/app/design-docs/design-doc.ts';

/*
 * The other half of the design document's own sentence: the hierarchy is
 * rebuilt from the ids when a reader wants it. The document says what changes
 * and nothing about what contains what, so every relation here is read back
 * out of the ids, and an ancestor the document never mentions is conjured
 * unchanged rather than left as a hole under one of its descendants.
 *
 * The document is read as the wire carries it — ids are plain strings, and a
 * field the writer left out is absent rather than defaulted.
 */

/** What a design does to one collection, as the JSON form spells it. */
interface ChangeSetInput<Item, Key> {
  added?: Item[] | undefined;
  removed?: Key[] | undefined;
  modified?: Item[] | undefined;
}

/** Where an element sits, read out of its id and nothing else. */
interface Place {
  kind: OutlineKind;
  parentPath: string | null;
}

export function outlineOf(document: DesignDocumentInput): OutlineNode[] {
  const nodes = new Map<string, OutlineNode>();
  addModules(nodes, document.modules);
  addBuildingBlocks(nodes, document.buildingBlocks);
  addBehaviours(nodes, document.behaviours);
  addImpliedAncestors(nodes);
  return inReadingOrder(nodes.values());
}

function addModules(
  nodes: Map<string, OutlineNode>,
  modules: ChangeSetInput<DesignedDomainModuleInput, string> | undefined,
): void {
  for (const [module, change] of named(modules))
    put(nodes, element(module.id, change, null, module.description?.value));
  for (const id of modules?.removed ?? []) put(nodes, element(id, 'removed'));
}

function addBuildingBlocks(
  nodes: Map<string, OutlineNode>,
  blocks: ChangeSetInput<DesignedBuildingBlockInput, string> | undefined,
): void {
  for (const [block, change] of named(blocks)) {
    put(
      nodes,
      element(
        block.id,
        change,
        block.type?.value ?? null,
        block.description?.value,
      ),
    );
    addProperties(nodes, block.id, block.properties);
    addRules(nodes, block.id, block.rules);
    addScenarios(nodes, block.id, block.scenarios);
  }
  for (const id of blocks?.removed ?? []) put(nodes, element(id, 'removed'));
}

function addBehaviours(
  nodes: Map<string, OutlineNode>,
  behaviours: ChangeSetInput<DesignedBehaviourInput, string> | undefined,
): void {
  for (const [behaviour, change] of named(behaviours)) {
    put(
      nodes,
      element(
        behaviour.id,
        change,
        behaviour.type?.value ?? null,
        behaviour.description?.value,
      ),
    );
    addRules(nodes, behaviour.id, behaviour.rules);
    addScenarios(nodes, behaviour.id, behaviour.scenarios);
  }
  for (const id of behaviours?.removed ?? [])
    put(nodes, element(id, 'removed'));
}

function addProperties(
  nodes: Map<string, OutlineNode>,
  owner: string,
  properties: ChangeSetInput<DesignedPropertyInput, string> | undefined,
): void {
  for (const [property, change] of named(properties))
    put(
      nodes,
      part(
        owner,
        'property',
        property.name.value,
        change,
        property.type?.value ?? null,
        property.description?.value,
      ),
    );
  for (const name of properties?.removed ?? [])
    put(nodes, part(owner, 'property', name, 'removed'));
}

function addRules(
  nodes: Map<string, OutlineNode>,
  owner: string,
  rules: ChangeSetInput<DesignedRuleInput, string> | undefined,
): void {
  for (const [rule, change] of named(rules))
    put(
      nodes,
      part(
        owner,
        'rule',
        rule.name.value,
        change,
        rule.ruleType ?? null,
        rule.description?.value,
      ),
    );
  for (const name of rules?.removed ?? [])
    put(nodes, part(owner, 'rule', name, 'removed'));
}

function addScenarios(
  nodes: Map<string, OutlineNode>,
  owner: string,
  scenarios: ChangeSetInput<DesignedScenarioInput, string> | undefined,
): void {
  for (const [scenario, change] of named(scenarios))
    put(
      nodes,
      part(
        owner,
        'scenario',
        scenario.name.value,
        change,
        null,
        scenario.description.value,
      ),
    );
  for (const name of scenarios?.removed ?? [])
    put(nodes, part(owner, 'scenario', name, 'removed'));
}

/** Every item the design spells out, with what it does to it; removals are keys, not items. */
function* named<Item>(
  set: ChangeSetInput<Item, string> | undefined,
): Generator<[Item, OutlineChange]> {
  for (const item of set?.added ?? []) yield [item, 'added'];
  for (const item of set?.modified ?? []) yield [item, 'modified'];
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

function element(
  id: string,
  change: OutlineChange,
  pattern: string | null = null,
  description: string | null | undefined = null,
): OutlineNode {
  const { kind, parentPath } = placeOf(id);
  return {
    path: id,
    parentPath,
    elementId: id,
    kind,
    name: nameOf(id),
    depth: 0,
    change,
    pattern,
    patternLabel: patternLabelOf(pattern),
    hasDiagram: drawsDiagram(description),
  };
}

function part(
  owner: string,
  kind: OutlineKind,
  name: string,
  change: OutlineChange,
  pattern: string | null = null,
  description: string | null | undefined = null,
): OutlineNode {
  return {
    // A part has no id of its own, so it is named under the element that owns
    // it; a name never carries the separators, so the pair cannot collide.
    path: `${owner}#${kind}:${name}`,
    parentPath: owner,
    elementId: null,
    kind,
    name,
    depth: 0,
    change,
    pattern,
    patternLabel: patternLabelOf(pattern),
    hasDiagram: drawsDiagram(description),
  };
}

const MODULE = 'module|';
const BUILDING_BLOCK = 'building_block|';
const BEHAVIOUR = 'behavior|';

/** An id's address: its dotted path, without the kind it is written with. */
const addressOf = (id: string) => id.slice(id.indexOf('|') + 1);

/** The element's own name: `PaymentHold`, never `scheduling.payments.PaymentHold`. */
const nameOf = (id: string) => addressOf(id).split('.').at(-1) ?? id;

/**
 * The one place that reads containment out of an id: the rule `ElementId`
 * states on the server, read back off the strings the wire carries. A
 * behaviour hangs under its building block, a building block and a submodule
 * under their module, and a root module under nothing.
 */
function placeOf(id: string): Place {
  const address = addressOf(id);
  const cut = address.lastIndexOf('.');
  const parentPath = (kind: string) =>
    cut === -1 ? null : `${kind}${address.slice(0, cut)}`;

  if (id.startsWith(BEHAVIOUR))
    return { kind: 'behaviour', parentPath: parentPath(BUILDING_BLOCK) };
  if (id.startsWith(BUILDING_BLOCK))
    return { kind: 'building_block', parentPath: parentPath(MODULE) };
  return { kind: 'module', parentPath: parentPath(MODULE) };
}
