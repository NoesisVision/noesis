import { BuildingBlockId, ElementId, ModuleId } from '#backend/app/element-id';
import {
  drawsDiagram,
  inReadingOrder,
  type OutlineChange,
  type OutlineKind,
  type OutlineNode,
  patternLabelOf,
} from '#backend/app/model-outline/model-outline';
import type {
  DesignDocument,
  DesignedBehaviour,
  DesignedBehaviourChangeSet,
  DesignedBuildingBlock,
  DesignedBuildingBlockChangeSet,
  DesignedDomainModule,
  DesignedDomainModuleChangeSet,
  DesignedPropertyChangeSet,
  DesignedRuleChangeSet,
  DesignedScenarioChangeSet,
} from './design-doc';

/*
 * The other half of the design document's own sentence: the hierarchy is
 * rebuilt from the ids when a reader wants it. The document says what changes
 * and nothing about what contains what, so every relation here is read back
 * out of the ids, and an ancestor the document never mentions is conjured
 * unchanged rather than left as a hole under one of its descendants.
 */

/** Where an element sits, read out of its id and nothing else. */
interface Place {
  kind: OutlineKind;
  parentPath: string | null;
}

export function outlineOf(document: DesignDocument): OutlineNode[] {
  const nodes = new Map<string, OutlineNode>();
  addModules(nodes, document.modules);
  addBuildingBlocks(nodes, document.buildingBlocks);
  addBehaviours(nodes, document.behaviours);
  addImpliedAncestors(nodes);
  return inReadingOrder(nodes.values());
}

function addModules(
  nodes: Map<string, OutlineNode>,
  modules: DesignedDomainModuleChangeSet,
): void {
  const add = (module: DesignedDomainModule, change: OutlineChange) =>
    put(nodes, element(module.id, change, null, module.description.value));

  for (const module of modules.added) add(module, 'added');
  for (const module of modules.modified) add(module, 'modified');
  for (const id of modules.removed) put(nodes, element(id, 'removed'));
}

function addBuildingBlocks(
  nodes: Map<string, OutlineNode>,
  blocks: DesignedBuildingBlockChangeSet,
): void {
  const add = (block: DesignedBuildingBlock, change: OutlineChange) => {
    put(
      nodes,
      element(block.id, change, block.type.value, block.description.value),
    );
    addProperties(nodes, block.id, block.properties);
    addRules(nodes, block.id, block.rules);
    addScenarios(nodes, block.id, block.scenarios);
  };

  for (const block of blocks.added) add(block, 'added');
  for (const block of blocks.modified) add(block, 'modified');
  for (const id of blocks.removed) put(nodes, element(id, 'removed'));
}

function addBehaviours(
  nodes: Map<string, OutlineNode>,
  behaviours: DesignedBehaviourChangeSet,
): void {
  const add = (behaviour: DesignedBehaviour, change: OutlineChange) => {
    put(
      nodes,
      element(
        behaviour.id,
        change,
        behaviour.type.value,
        behaviour.description.value,
      ),
    );
    addRules(nodes, behaviour.id, behaviour.rules);
    addScenarios(nodes, behaviour.id, behaviour.scenarios);
  };

  for (const behaviour of behaviours.added) add(behaviour, 'added');
  for (const behaviour of behaviours.modified) add(behaviour, 'modified');
  for (const id of behaviours.removed) put(nodes, element(id, 'removed'));
}

function addProperties(
  nodes: Map<string, OutlineNode>,
  owner: ElementId,
  properties: DesignedPropertyChangeSet | undefined,
): void {
  if (properties === undefined) return;
  const add = (
    property: DesignedPropertyChangeSet['added'][number],
    change: OutlineChange,
  ) =>
    put(
      nodes,
      part(
        owner,
        'property',
        property.name.value,
        change,
        property.type.value,
        property.description.value,
      ),
    );

  for (const property of properties.added) add(property, 'added');
  for (const property of properties.modified) add(property, 'modified');
  for (const name of properties.removed)
    put(nodes, part(owner, 'property', name, 'removed'));
}

function addRules(
  nodes: Map<string, OutlineNode>,
  owner: ElementId,
  rules: DesignedRuleChangeSet | undefined,
): void {
  if (rules === undefined) return;
  const add = (
    rule: DesignedRuleChangeSet['added'][number],
    change: OutlineChange,
  ) =>
    put(
      nodes,
      part(
        owner,
        'rule',
        rule.name.value,
        change,
        rule.ruleType,
        rule.description.value,
      ),
    );

  for (const rule of rules.added) add(rule, 'added');
  for (const rule of rules.modified) add(rule, 'modified');
  for (const name of rules.removed)
    put(nodes, part(owner, 'rule', name, 'removed'));
}

function addScenarios(
  nodes: Map<string, OutlineNode>,
  owner: ElementId,
  scenarios: DesignedScenarioChangeSet | undefined,
): void {
  if (scenarios === undefined) return;
  const add = (
    scenario: DesignedScenarioChangeSet['added'][number],
    change: OutlineChange,
  ) =>
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

  for (const scenario of scenarios.added) add(scenario, 'added');
  for (const scenario of scenarios.modified) add(scenario, 'modified');
  for (const name of scenarios.removed)
    put(nodes, part(owner, 'scenario', name, 'removed'));
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
      const ancestor = element(parentPath as ElementId, 'unchanged');
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
  id: ElementId,
  change: OutlineChange,
  pattern: string | null = null,
  description: string | null = null,
): OutlineNode {
  const { kind, parentPath } = placeOf(id);
  return {
    path: id,
    parentPath,
    elementId: id,
    kind,
    name: ElementId.nameOf(id),
    depth: 0,
    change,
    pattern,
    patternLabel: patternLabelOf(pattern),
    hasDiagram: drawsDiagram(description),
  };
}

function part(
  owner: ElementId,
  kind: OutlineKind,
  name: string,
  change: OutlineChange,
  pattern: string | null = null,
  description: string | null = null,
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

/** The one place that reads containment out of an id. */
function placeOf(id: ElementId): Place {
  return ElementId.match<Place>(id, {
    module: (moduleId) => ({
      kind: 'module',
      parentPath: ModuleId.parentOf(moduleId),
    }),
    buildingBlock: (blockId) => ({
      kind: 'building_block',
      parentPath: ModuleId.containing(blockId),
    }),
    behavior: (behaviorId) => ({
      kind: 'behaviour',
      parentPath: BuildingBlockId.containing(behaviorId),
    }),
  });
}
