import type { OutlineKind } from '#/features/design-docs/ui/model-tree/model-outline.ts';
import type {
  ActorId,
  BehaviorId,
  BuildingBlockId,
  DeployableUnitId,
  DeploymentContainerId,
  ElementId,
  LayerId,
  LibraryId,
  ManualProcessId,
  ModuleId,
  RuleId,
  ScenarioId,
} from '#backend/app/element-id.ts';

/*
 * The one place that reads an element's id: the rule `ElementId` states on
 * the server, read back off the strings the wire carries. An id is the kind
 * it is written with, a `|`, and a dotted address; a behavior hangs under
 * its building block, a building block and a submodule under their module,
 * a root module under nothing — and a rule under the module of the behavior
 * that governs it, a scenario under its rule. An actor and a manual process
 * hang under nothing: their address is their name. So do a deployable unit
 * and a library, whose name is the build's, dots and all, and a layer and a
 * deployment container.
 *
 * The ids are the server's own value objects, imported as types only: the
 * page may not run backend code, so an id is told by its prefix here, the
 * rest having been checked by the server that wrote it. What this file
 * builds comes back branded, and what it takes is a plain wire string or an
 * id of the kind it expects — never one of another kind.
 */

const MODULE = 'module|';
const BUILDING_BLOCK = 'building_block|';
const BEHAVIOR = 'behavior|';
const RULE = 'rule|';
const SCENARIO = 'scenario|';
const ACTOR = 'actor|';
const MANUAL_PROCESS = 'manual_process|';
const DEPLOYABLE_UNIT = 'deployable_unit|';
const LIBRARY = 'library|';
const LAYER = 'layer|';
const DEPLOYMENT_CONTAINER = 'deployment_container|';

/**
 * A wire string, or an id already known to be `Expected`: an id branded as
 * another kind is refused, so a `ModuleId` cannot go where a
 * `BuildingBlockId` is asked for.
 */
type IdOrWire<Expected extends ElementId, Given extends string> =
  Given extends Exclude<ElementId, Expected> ? never : Given;

/** An id's address: its dotted path, without the kind it is written with. */
export const addressOf = (id: string) => id.slice(id.indexOf('|') + 1);

/**
 * The element's own name: `PaymentHold`, never `scheduling.payments.PaymentHold`;
 * a deployable unit's or a library's whole, as `MyCompany.Sales` is one name.
 */
export const nameOf = (id: string) =>
  isArtifact(id) ? addressOf(id) : (addressOf(id).split('.').at(-1) ?? id);

/** The building block a type reference names; null for a primitive. */
export function blockOfRef(ref: string): BuildingBlockId | null {
  return isBuildingBlock(ref) ? ref : null;
}

/** What an id names. An id of no element kind is a fault in the data, and says so. */
export function kindOf(
  id: string,
): Extract<
  OutlineKind,
  | 'module'
  | 'building_block'
  | 'behavior'
  | 'rule'
  | 'scenario'
  | 'actor'
  | 'manual_process'
  | 'deployable_unit'
  | 'library'
  | 'layer'
  | 'deployment_container'
> {
  if (isBehavior(id)) return 'behavior';
  if (isBuildingBlock(id)) return 'building_block';
  if (isModule(id)) return 'module';
  if (isRule(id)) return 'rule';
  if (isScenario(id)) return 'scenario';
  if (isActor(id)) return 'actor';
  if (isManualProcess(id)) return 'manual_process';
  if (isDeployableUnit(id)) return 'deployable_unit';
  if (isLibrary(id)) return 'library';
  if (isLayer(id)) return 'layer';
  if (isDeploymentContainer(id)) return 'deployment_container';
  throw new Error(`Not an element id: ${id}`);
}

/** The building block a behavior is on. */
export const ownerOf = <Given extends string>(
  behaviorId: IdOrWire<BehaviorId, Given>,
): BuildingBlockId => {
  if (!isBehavior(behaviorId))
    throw new Error(`Not a behavior id: ${behaviorId}`);
  return asBuildingBlock(`${BUILDING_BLOCK}${parentAddressOf(behaviorId)}`);
};

/**
 * The module an element is in: a building block's, a behavior's building
 * block's — and a module's own, since it is the module it stands for.
 */
export function moduleOf(elementId: string): ModuleId {
  if (isModule(elementId)) return elementId;
  if (isBehavior(elementId)) return moduleOf(ownerOf(elementId));
  if (isScenario(elementId))
    return moduleOf(`${RULE}${parentAddressOf(elementId)}`);
  if (isBuildingBlock(elementId) || isRule(elementId))
    return asModule(`${MODULE}${parentAddressOf(elementId)}`);
  throw new Error(`Not an element id: ${elementId}`);
}

/** The building block at an address: `a.b.C` is `building_block|a.b.C`. */
export const blockIdAt = (address: string): BuildingBlockId =>
  asBuildingBlock(`${BUILDING_BLOCK}${address}`);

/** The behavior at an address: `a.b.C.do` is `behavior|a.b.C.do`. */
export const behaviorIdAt = (address: string): BehaviorId =>
  asBehavior(`${BEHAVIOR}${address}`);

/** The module at an address: `a.b.C` is `module|a.b.C`. */
export const moduleIdAt = (address: string): ModuleId =>
  asModule(`${MODULE}${address}`);

/** What an element hangs under by its id; null for a root module and every element that hangs under nothing. */
export function parentOf(
  id: string,
): ModuleId | BuildingBlockId | RuleId | null {
  if (!addressOf(id).includes('.') || isTopLevel(id)) return null;
  if (isBehavior(id)) return ownerOf(id);
  if (isScenario(id)) return `${RULE}${parentAddressOf(id)}` as RuleId;
  return asModule(`${MODULE}${parentAddressOf(id)}`);
}

/** Whether a string is an element id of any kind, rather than a name or a primitive. */
export const isElementId = (value: string): boolean =>
  isModule(value) ||
  isBuildingBlock(value) ||
  isBehavior(value) ||
  isRule(value) ||
  isScenario(value) ||
  isActor(value) ||
  isManualProcess(value) ||
  isArtifact(value) ||
  isLayer(value) ||
  isDeploymentContainer(value);

/** Whether an element hangs under nothing whatever its name: an actor, a manual process, a unit, a library, a layer, a container. */
const isTopLevel = (id: string): boolean =>
  isActor(id) ||
  isManualProcess(id) ||
  isArtifact(id) ||
  isLayer(id) ||
  isDeploymentContainer(id);

const PREFIX_OF = {
  module: MODULE,
  building_block: BUILDING_BLOCK,
  behavior: BEHAVIOR,
  rule: RULE,
  scenario: SCENARIO,
  actor: ACTOR,
  manual_process: MANUAL_PROCESS,
  deployable_unit: DEPLOYABLE_UNIT,
  library: LIBRARY,
  layer: LAYER,
  deployment_container: DEPLOYMENT_CONTAINER,
} as const;

/**
 * The id an element named `name` takes under `parent`: a root module under
 * nothing, a submodule or building block under a module, a behavior under
 * a building block.
 */
export const childIdOf = (
  kind: keyof typeof PREFIX_OF,
  parent: string | null,
  name: string,
): string =>
  `${PREFIX_OF[kind]}${parent === null ? '' : `${addressOf(parent)}.`}${name}`;

/**
 * Whether `id` is `ancestor` itself or sits under it: a module holds every
 * kind, a building block only its behaviors, a rule only its scenarios.
 */
export function isWithin(id: string, ancestor: string): boolean {
  if (id === ancestor) return true;
  if (!addressOf(id).startsWith(`${addressOf(ancestor)}.`)) return false;
  return (
    isModule(ancestor) ||
    (isBuildingBlock(ancestor) && isBehavior(id)) ||
    (isRule(ancestor) && isScenario(id))
  );
}

function parentAddressOf(id: string): string {
  const address = addressOf(id);
  return address.slice(0, Math.max(0, address.lastIndexOf('.')));
}

function isModule(id: string): id is ModuleId {
  return id.startsWith(MODULE);
}

function isBuildingBlock(id: string): id is BuildingBlockId {
  return id.startsWith(BUILDING_BLOCK);
}

function isBehavior(id: string): id is BehaviorId {
  return id.startsWith(BEHAVIOR);
}

function isRule(id: string): id is RuleId {
  return id.startsWith(RULE);
}

function isScenario(id: string): id is ScenarioId {
  return id.startsWith(SCENARIO);
}

function isActor(id: string): id is ActorId {
  return id.startsWith(ACTOR);
}

function isManualProcess(id: string): id is ManualProcessId {
  return id.startsWith(MANUAL_PROCESS);
}

function isDeployableUnit(id: string): id is DeployableUnitId {
  return id.startsWith(DEPLOYABLE_UNIT);
}

function isLibrary(id: string): id is LibraryId {
  return id.startsWith(LIBRARY);
}

function isLayer(id: string): id is LayerId {
  return id.startsWith(LAYER);
}

function isDeploymentContainer(id: string): id is DeploymentContainerId {
  return id.startsWith(DEPLOYMENT_CONTAINER);
}

/** A build artifact: a deployable unit or a library. */
function isArtifact(id: string): id is DeployableUnitId | LibraryId {
  return isDeployableUnit(id) || isLibrary(id);
}

function asModule(id: string): ModuleId {
  if (!isModule(id)) throw new Error(`Not a module id: ${id}`);
  return id;
}

/** A wire id the server wrote as a building block's, as the `BuildingBlockId` it is. */
export function asBuildingBlock(id: string): BuildingBlockId {
  if (!isBuildingBlock(id)) throw new Error(`Not a building block id: ${id}`);
  return id;
}

/** A wire id the server wrote as a behavior's, as the `BehaviorId` it is. */
export function asBehavior(id: string): BehaviorId {
  if (!isBehavior(id)) throw new Error(`Not a behavior id: ${id}`);
  return id;
}
