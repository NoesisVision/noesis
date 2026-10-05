import type { OutlineChange } from '#/features/design-docs/ui/model-tree/model-outline.ts';
import type {
  DesignDocumentInput,
  DesignedBehaviourInput,
  DesignedBuildingBlockInput,
  DesignedRuleInput,
} from '#backend/app/design-docs/design-doc.ts';
import type {
  BehaviorId,
  BuildingBlockId,
  ModuleId,
} from '#backend/app/element-id.ts';
import type {
  BuildingBlockRefInput,
  BuildingBlockType,
} from '#backend/app/system-model/system-model.ts';
import { architectureChecks } from './architecture-checks.ts';
import {
  type ArchitectureOutline,
  type Hexagon,
  isDrivenPort,
  type PlacedBehaviour,
  type PlacedBlock,
  type PlacedElement,
  type PlacedRule,
} from './architecture-outline.ts';
import {
  type ChangeSetInput,
  findById,
  named,
  writtenIn,
} from './change-set.ts';
import { valueOf } from './design-doc-field.ts';
import {
  asBehaviour,
  asBuildingBlock,
  blockOfRef,
  moduleOf,
  nameOf,
  ownerOf,
} from './element-id.ts';

/*
 * The design read on the assumption that the system it designs is built as
 * hexagons: each module that holds building blocks is one, its application
 * services' public behaviours are the ports that drive it, and its
 * repositories and external integrations are the ports it drives. Nothing
 * here is stored — it is the same document, placed in rings by the building
 * block types it already names.
 *
 * The document carries only what a design changes, so an element whose type
 * the design leaves alone cannot be placed from it, and is listed as such.
 */

const DOMAIN_CORE = [
  'aggregate',
  'entity',
  'domain_service',
  'factory',
  'value_object',
] as const satisfies readonly BuildingBlockType[];
const APPLICATION_SERVICE = 'application_service' satisfies BuildingBlockType;

export function architectureOf(
  document: DesignDocumentInput,
): ArchitectureOutline {
  const blocks = [...named(document.buildingBlocks)];
  const behaviours = [...named(document.behaviours)];
  const typeOf = new Map(
    blocks.map(([block]) => [block.id, valueOf(block.type)]),
  );
  const hexagons = new Map<ModuleId, Hexagon>();
  const unplaced: PlacedElement[] = [];
  const hexagonOf = (elementId: string) => {
    const moduleId = moduleOf(elementId);
    let hexagon = hexagons.get(moduleId);
    if (hexagon === undefined) {
      hexagon = emptyHexagon(moduleId, moduleNameOf(document, moduleId));
      hexagons.set(moduleId, hexagon);
    }
    return hexagon;
  };

  const ports = new Set<BehaviorId>();
  for (const [item, change] of behaviours) {
    const owner = ownerOf(item.id);
    const visibility = valueOf(item.visibility);
    const type = typeOf.get(owner);
    // A design may change a behaviour and leave its block out: nothing says
    // what the block is, and the behaviour has no block here to be read with.
    if (type === undefined) {
      unplaced.push(behaviourElement(item, change));
      continue;
    }
    if (type !== APPLICATION_SERVICE) {
      // A block whose type the design leaves alone may well be a service.
      if (visibility?.kind === 'public' && type !== null)
        hexagonOf(owner).exposed.push(behaviourElement(item, change));
      continue;
    }
    if (visibility === null) {
      unplaced.push(behaviourElement(item, change));
      continue;
    }
    if (visibility.kind !== 'public') continue;
    ports.add(asBehaviour(item.id));
    hexagonOf(owner).drivingPorts.push({
      behaviour: behaviourElement(item, change),
      service: owner,
      actors: visibility.actors,
    });
  }

  for (const [item, change] of blocks) {
    const own = behaviours
      .map(([behaviour]) => behaviour)
      .filter(
        (behaviour) =>
          ownerOf(behaviour.id) === item.id &&
          !ports.has(asBehaviour(behaviour.id)),
      );
    const element = blockElement(item, change, own);
    const ring = ringOf(element.pattern);
    if (ring === null) unplaced.push(element);
    else hexagonOf(item.id)[ring].push(element);
  }
  for (const hexagon of hexagons.values())
    hexagon.domainCore.sort(
      (a, b) => coreRank(a.pattern) - coreRank(b.pattern),
    );

  const drawn = [...hexagons.values()];
  return {
    hexagons: drawn,
    unplaced,
    checks: architectureChecks({ hexagons: drawn, unplaced }),
    needsAtPorts: needsAtPorts(document, drawn),
  };
}

/**
 * A need and the driving ports whose own rules answer it: where a reviewer
 * finds the need at the edge of the system. A need no port answers has none.
 */
function needsAtPorts(
  document: DesignDocumentInput,
  hexagons: Hexagon[],
): ArchitectureOutline['needsAtPorts'] {
  const ports = hexagons.flatMap(({ drivingPorts }) => drivingPorts);
  return writtenIn(document.needs).map((need) => ({
    need,
    ports: ports
      .filter(({ behaviour }) =>
        behaviour.rules.some((rule) => rule.needs.includes(need.id)),
      )
      .map(({ behaviour }) => behaviour.id),
  }));
}

/** A type one behaviour gives back and another takes, read from the types alone. */
export interface InferredFlow {
  direction: 'gives' | 'takes';
  type: BuildingBlockId;
  /** The behaviour at the other end. */
  other: { id: BehaviorId; name: string; owner: string };
  /**
   * The types match, but the design keeps the two apart: a private behaviour
   * in another hexagon cannot be what takes it.
   */
  typeMatchOnly: boolean;
}

/**
 * For one element — a behaviour, or a building block through its behaviours —
 * every behaviour that takes a type it gives back, or gives back a type it
 * takes. The document has no calls, so this is a guess from the types, never
 * drawn as an edge.
 */
export function inferredFlowOf(
  document: DesignDocumentInput,
  outline: ArchitectureOutline,
  elementId: string,
): InferredFlow[] {
  const behaviours = writtenIn(document.behaviours).map((behaviour) => ({
    id: asBehaviour(behaviour.id),
    inputs: blocksOf(inputTypesOf(behaviour)),
    outputs: blocksOf(outputTypesOf(behaviour)),
  }));
  const isOwn = (id: string) => id === elementId || ownerOf(id) === elementId;
  const ports = new Set(
    outline.hexagons.flatMap(({ drivingPorts }) =>
      drivingPorts.map(({ behaviour }) => behaviour.id),
    ),
  );
  // By what a reader is told: a block whose behaviours share a type would
  // otherwise say the same flow once for each of them.
  const flows = new Map<string, InferredFlow>();
  for (const mine of behaviours.filter(({ id }) => isOwn(id)))
    for (const other of behaviours.filter(({ id }) => !isOwn(id))) {
      const flow = (
        direction: InferredFlow['direction'],
        type: BuildingBlockId,
      ) => {
        const taker = direction === 'gives' ? other.id : mine.id;
        const typeMatchOnly =
          moduleOf(mine.id) !== moduleOf(other.id) && !ports.has(taker);
        const key = `${direction}:${type}:${other.id}`;
        const known = flows.get(key);
        // One behaviour that can take it is enough for more than a match.
        if (known) known.typeMatchOnly &&= typeMatchOnly;
        else
          flows.set(key, {
            direction,
            type,
            other: {
              id: other.id,
              name: nameOf(other.id),
              owner: nameOf(ownerOf(other.id)),
            },
            typeMatchOnly,
          });
      };
      for (const type of mine.outputs)
        if (other.inputs.has(type)) flow('gives', type);
      for (const type of mine.inputs)
        if (other.outputs.has(type)) flow('takes', type);
    }
  return [...flows.values()];
}

type Ring = 'applicationServices' | 'domainCore' | 'drivenPorts';

function ringOf(pattern: BuildingBlockType | null): Ring | null {
  if (pattern === APPLICATION_SERVICE) return 'applicationServices';
  if (isDrivenPort(pattern)) return 'drivenPorts';
  if ((DOMAIN_CORE as readonly (BuildingBlockType | null)[]).includes(pattern))
    return 'domainCore';
  return null;
}

const coreRank = (pattern: BuildingBlockType | null) =>
  (DOMAIN_CORE as readonly (BuildingBlockType | null)[]).indexOf(pattern);

function blockElement(
  block: DesignedBuildingBlockInput,
  change: OutlineChange,
  behaviours: DesignedBehaviourInput[],
): PlacedBlock {
  return {
    id: asBuildingBlock(block.id),
    name: nameOf(block.id),
    pattern: valueOf(block.type),
    change,
    uses: usesOf(block.id, [
      ...writtenIn(block.properties).map(({ type }) => valueOf(type)),
      ...behaviours.flatMap(typesOfBehaviour),
    ]),
    rules: [block, ...behaviours].flatMap(rulesOf),
  };
}

function behaviourElement(
  behaviour: DesignedBehaviourInput,
  change: OutlineChange,
): PlacedBehaviour {
  return {
    id: asBehaviour(behaviour.id),
    name: nameOf(behaviour.id),
    pattern: valueOf(behaviour.type),
    change,
    uses: usesOf(behaviour.id, typesOfBehaviour(behaviour)),
    rules: rulesOf(behaviour),
  };
}

const inputTypesOf = (behaviour: DesignedBehaviourInput) =>
  writtenIn(behaviour.input).map(({ type }) => valueOf(type));

const outputTypesOf = (behaviour: DesignedBehaviourInput) =>
  writtenIn(behaviour.output).map(({ type }) => type);

const typesOfBehaviour = (
  behaviour: DesignedBehaviourInput,
): (BuildingBlockRefInput | null)[] => [
  ...inputTypesOf(behaviour),
  ...outputTypesOf(behaviour),
];

const blocksOf = (types: (BuildingBlockRefInput | null)[]) =>
  new Set(usesOf('', types));

function rulesOf(owner: {
  rules?: ChangeSetInput<DesignedRuleInput, string> | undefined;
}): PlacedRule[] {
  return writtenIn(owner.rules).map((rule) => ({
    name: rule.name,
    category: valueOf(rule.category),
    ruleType: valueOf(rule.ruleType),
    needs: valueOf(rule.needs) ?? [],
  }));
}

/** The building blocks a list of types names, each once; primitives and the element itself left out. */
function usesOf(
  self: string,
  types: (BuildingBlockRefInput | null)[],
): BuildingBlockId[] {
  const uses = new Set<BuildingBlockId>();
  for (const type of types) {
    const block = type === null ? null : blockOfRef(type);
    if (block !== null && block !== self) uses.add(block);
  }
  return [...uses];
}

function emptyHexagon(id: ModuleId, name: string): Hexagon {
  return {
    module: { id, name },
    drivingPorts: [],
    applicationServices: [],
    domainCore: [],
    drivenPorts: [],
    exposed: [],
  };
}

function moduleNameOf(document: DesignDocumentInput, moduleId: ModuleId) {
  return (
    valueOf(findById(document.modules, moduleId)?.name) ?? nameOf(moduleId)
  );
}
