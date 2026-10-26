import type { OutlineKind } from '#/features/design-docs/ui/model-tree/model-outline.ts';
import type {
  BehaviorId,
  BuildingBlockId,
  ElementId,
  ModuleId,
} from '#backend/app/element-id.ts';
import type { BuildingBlockRefInput } from '#backend/app/system-model/system-model.ts';

/*
 * The one place that reads an element's id: the rule `ElementId` states on
 * the server, read back off the strings the wire carries. An id is the kind
 * it is written with, a `|`, and a dotted address; a behavior hangs under
 * its building block, a building block and a submodule under their module,
 * and a root module under nothing.
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

/**
 * A wire string, or an id already known to be `Expected`: an id branded as
 * another kind is refused, so a `ModuleId` cannot go where a
 * `BuildingBlockId` is asked for.
 */
type IdOrWire<Expected extends ElementId, Given extends string> =
  Given extends Exclude<ElementId, Expected> ? never : Given;

/** An id's address: its dotted path, without the kind it is written with. */
export const addressOf = (id: string) => id.slice(id.indexOf('|') + 1);

/** The element's own name: `PaymentHold`, never `scheduling.payments.PaymentHold`. */
export const nameOf = (id: string) => addressOf(id).split('.').at(-1) ?? id;

/** The id a type reference names, a collection by its item. */
export const refIdOf = (ref: BuildingBlockRefInput): string =>
  typeof ref === 'string' ? ref : refIdOf(ref.collectionOf);

/** The building block a type reference names, through any collection; null for a primitive. */
export function blockOfRef(ref: BuildingBlockRefInput): BuildingBlockId | null {
  const id = refIdOf(ref);
  return isBuildingBlock(id) ? id : null;
}

/** What an id names. An id of no element kind is a fault in the data, and says so. */
export function kindOf(
  id: string,
): Extract<OutlineKind, 'module' | 'building_block' | 'behavior'> {
  if (isBehavior(id)) return 'behavior';
  if (isBuildingBlock(id)) return 'building_block';
  if (isModule(id)) return 'module';
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
  if (isBuildingBlock(elementId))
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

/** What an element hangs under; null for a root module. */
export function parentOf(id: string): ModuleId | BuildingBlockId | null {
  if (!addressOf(id).includes('.')) return null;
  return isBehavior(id)
    ? ownerOf(id)
    : asModule(`${MODULE}${parentAddressOf(id)}`);
}

/** Whether a string is an element id of any kind, rather than a name or a primitive. */
export const isElementId = (value: string): boolean =>
  isModule(value) || isBuildingBlock(value) || isBehavior(value);

const PREFIX_OF = {
  module: MODULE,
  building_block: BUILDING_BLOCK,
  behavior: BEHAVIOR,
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
 * kind, a building block only its behaviors.
 */
export function isWithin(id: string, ancestor: string): boolean {
  if (id === ancestor) return true;
  if (!addressOf(id).startsWith(`${addressOf(ancestor)}.`)) return false;
  return isModule(ancestor) || (isBuildingBlock(ancestor) && isBehavior(id));
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
