import type { OutlineChange } from '#/features/design-docs/ui/model-tree/model-outline.ts';
import type {
  DesignDocumentInput,
  DesignedBehaviorInput,
  DesignedBuildingBlockInput,
} from '#backend/app/design-docs/design-doc.ts';
import type {
  BehaviorId,
  BuildingBlockId,
  ModuleId,
} from '#backend/app/element-id.ts';
import type { BuildingBlockType } from '#backend/app/system-model/system-model.ts';
import { architectureChecks } from './architecture-checks.ts';
import {
  type ArchitectureOutline,
  type Hexagon,
  isDrivenPort,
  type PlacedBehavior,
  type PlacedBlock,
  type PlacedElement,
  type PlacedRule,
} from './architecture-outline.ts';
import { findById, named, writtenIn } from './change-set.ts';
import { valueOf } from './design-doc-field.ts';
import {
  asBehavior,
  asBuildingBlock,
  blockOfRef,
  moduleOf,
  nameOf,
  ownerOf,
} from './element-id.ts';
import { relationsFrom } from './relations.ts';
import { ruleNameOf, rulesUnder } from './rules.ts';

/*
 * The design read on the assumption that the system it designs is built as
 * hexagons: each module that holds building blocks is one, the behaviors of
 * its application services and in adapters are the ports that drive it —
 * their actors those who perform the manual processes that invoke them,
 * directly or through an in adapter — and its repositories, external integrations, out adapters and
 * technical services are the ports it drives. Its messages — commands,
 * queries, events — sit in the domain core, as what crosses those ports. Nothing
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
  'command',
  'query',
  'event',
] as const satisfies readonly BuildingBlockType[];
/** The blocks that drive a hexagon: their behaviors are its ports. */
const DRIVING = [
  'application_service',
  'in_adapter',
] as const satisfies readonly BuildingBlockType[];
const isDriving = (type: BuildingBlockType | null) =>
  (DRIVING as readonly (BuildingBlockType | null)[]).includes(type);

export function architectureOf(
  document: DesignDocumentInput,
): ArchitectureOutline {
  const blocks = [...named(document.buildingBlocks)];
  const behaviors = [...named(document.behaviors)];
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

  const callers = callersOf(document, typeOf);
  const ports = new Set<BehaviorId>();
  for (const [item, change] of behaviors) {
    const owner = ownerOf(item.id);
    const type = typeOf.get(owner);
    // A design may change a behavior and leave its block out: nothing says
    // what the block is, and the behavior has no block here to be read with.
    if (type === undefined) {
      unplaced.push(behaviorElement(document, item, change));
      continue;
    }
    if (!isDriving(type)) {
      // A block whose type the design leaves alone may well be a service.
      if (type !== null && callers.reachesPast(item.id))
        hexagonOf(owner).exposed.push(behaviorElement(document, item, change));
      continue;
    }
    ports.add(asBehavior(item.id));
    hexagonOf(owner).drivingPorts.push({
      behavior: behaviorElement(document, item, change),
      service: owner,
      actors: callers.actorsOf(item.id),
      callerKnown: callers.isKnown(item.id),
    });
  }

  for (const [item, change] of blocks) {
    const own = behaviors
      .map(([behavior]) => behavior)
      .filter(
        (behavior) =>
          ownerOf(behavior.id) === item.id &&
          !ports.has(asBehavior(behavior.id)),
      );
    const element = blockElement(document, item, change, own);
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
 * Who calls a behavior, as the design's `invokes` relations say: a manual
 * process, whose actors drive it, or a behavior — an in adapter's passing
 * its own actors on, or one of another module reaching past that module's
 * ports.
 */
function callersOf(
  document: DesignDocumentInput,
  typeOf: ReadonlyMap<string, BuildingBlockType | null>,
) {
  const invokers = new Map<string, string[]>();
  const performers = new Map<string, string[]>();
  const add = (map: Map<string, string[]>, key: string, value: string) =>
    map.set(key, [...(map.get(key) ?? []), value]);
  for (const relation of writtenIn(document.relations))
    if (relation.kind === 'invokes') add(invokers, relation.to, relation.from);
    else if (relation.kind === 'performs')
      add(performers, relation.to, nameOf(relation.from));
  const isProcess = (id: string) => id.startsWith('manual_process|');
  const isInAdapter = (id: string) =>
    !isProcess(id) && typeOf.get(ownerOf(id)) === 'in_adapter';
  const actorsOf = (id: string, seen: Set<string>): string[] =>
    (invokers.get(id) ?? []).flatMap((caller) => {
      if (isProcess(caller)) return performers.get(caller) ?? [];
      if (!isInAdapter(caller) || seen.has(caller)) return [];
      return actorsOf(caller, new Set([...seen, caller]));
    });
  return {
    actorsOf: (id: string) =>
      [...new Set(actorsOf(id, new Set([id])))].sort((a, b) =>
        a.localeCompare(b),
      ),
    isKnown: (id: string) =>
      (invokers.get(id) ?? []).some(
        (caller) => isProcess(caller) || isInAdapter(caller),
      ),
    reachesPast: (id: string) =>
      (invokers.get(id) ?? []).some(
        (caller) => isProcess(caller) || moduleOf(caller) !== moduleOf(id),
      ),
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
      .filter(({ behavior }) =>
        behavior.rules.some((rule) => rule.needs.includes(need.id)),
      )
      .map(({ behavior }) => behavior.id),
  }));
}

/** A type one behavior gives back and another takes, read from the types alone. */
export interface InferredFlow {
  direction: 'gives' | 'takes';
  type: BuildingBlockId;
  /** The behavior at the other end. */
  other: { id: BehaviorId; name: string; owner: string };
  /**
   * The types match, but the design keeps the two apart: a private behavior
   * in another hexagon cannot be what takes it.
   */
  typeMatchOnly: boolean;
}

/**
 * For one element — a behavior, or a building block through its behaviors —
 * every behavior that takes a type it gives back, or gives back a type it
 * takes. The document has no calls, so this is a guess from the types, never
 * drawn as an edge.
 */
export function inferredFlowOf(
  document: DesignDocumentInput,
  outline: ArchitectureOutline,
  elementId: string,
): InferredFlow[] {
  const behaviors = writtenIn(document.behaviors).map((behavior) => ({
    id: asBehavior(behavior.id),
    inputs: blocksOf(inputTypesOf(document, behavior)),
    outputs: blocksOf(outputTypesOf(document, behavior)),
  }));
  const isOwn = (id: string) => id === elementId || ownerOf(id) === elementId;
  const ports = new Set(
    outline.hexagons.flatMap(({ drivingPorts }) =>
      drivingPorts.map(({ behavior }) => behavior.id),
    ),
  );
  // By what a reader is told: a block whose behaviors share a type would
  // otherwise say the same flow once for each of them.
  const flows = new Map<string, InferredFlow>();
  for (const mine of behaviors.filter(({ id }) => isOwn(id)))
    for (const other of behaviors.filter(({ id }) => !isOwn(id))) {
      const flow = (
        direction: InferredFlow['direction'],
        type: BuildingBlockId,
      ) => {
        const taker = direction === 'gives' ? other.id : mine.id;
        const typeMatchOnly =
          moduleOf(mine.id) !== moduleOf(other.id) && !ports.has(taker);
        const key = `${direction}:${type}:${other.id}`;
        const known = flows.get(key);
        // One behavior that can take it is enough for more than a match.
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
  if (isDriving(pattern)) return 'applicationServices';
  if (isDrivenPort(pattern)) return 'drivenPorts';
  if ((DOMAIN_CORE as readonly (BuildingBlockType | null)[]).includes(pattern))
    return 'domainCore';
  return null;
}

const coreRank = (pattern: BuildingBlockType | null) =>
  (DOMAIN_CORE as readonly (BuildingBlockType | null)[]).indexOf(pattern);

function blockElement(
  document: DesignDocumentInput,
  block: DesignedBuildingBlockInput,
  change: OutlineChange,
  behaviors: DesignedBehaviorInput[],
): PlacedBlock {
  return {
    id: asBuildingBlock(block.id),
    name: nameOf(block.id),
    pattern: valueOf(block.type),
    change,
    uses: usesOf(block.id, [
      ...writtenIn(relationsFrom(document, 'property', block.id)).map(
        ({ to }) => valueOf(to),
      ),
      ...writtenIn(relationsFrom(document, 'collaborator', block.id)).map(
        ({ to }) => valueOf(to),
      ),
      ...behaviors.flatMap((behavior) => typesOfBehavior(document, behavior)),
    ]),
    rules: behaviors.flatMap((behavior) => rulesOf(document, behavior.id)),
  };
}

function behaviorElement(
  document: DesignDocumentInput,
  behavior: DesignedBehaviorInput,
  change: OutlineChange,
): PlacedBehavior {
  return {
    id: asBehavior(behavior.id),
    name: nameOf(behavior.id),
    pattern: null,
    change,
    uses: usesOf(behavior.id, typesOfBehavior(document, behavior)),
    rules: rulesOf(document, behavior.id),
  };
}

const inputTypesOf = (
  document: DesignDocumentInput,
  behavior: DesignedBehaviorInput,
) =>
  writtenIn(relationsFrom(document, 'parameter', behavior.id)).map(({ to }) =>
    valueOf(to),
  );

const outputTypesOf = (
  document: DesignDocumentInput,
  behavior: DesignedBehaviorInput,
) =>
  writtenIn(relationsFrom(document, 'result', behavior.id)).map(({ to }) => to);

const typesOfBehavior = (
  document: DesignDocumentInput,
  behavior: DesignedBehaviorInput,
): (string | null)[] => [
  ...inputTypesOf(document, behavior),
  ...outputTypesOf(document, behavior),
];

const blocksOf = (types: (string | null)[]) => new Set(usesOf('', types));

/** The rules the design shows under an element, each once. */
function rulesOf(
  document: DesignDocumentInput,
  elementId: string,
): PlacedRule[] {
  return writtenIn(rulesUnder(document, elementId)).map((rule) => ({
    id: rule.id,
    name: ruleNameOf(rule),
    kind: valueOf(rule.kind),
    needs: valueOf(rule.needs) ?? [],
  }));
}

/** The building blocks a list of types names, each once; primitives and the element itself left out. */
function usesOf(self: string, types: (string | null)[]): BuildingBlockId[] {
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
