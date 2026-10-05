import type { OutlineKind } from '#/shared/ui/model-tree/model-outline.ts';
import type { BuildingBlockRefInput } from '#backend/app/system-model/system-model.ts';

/*
 * The one place that reads an element's id: the rule `ElementId` states on
 * the server, read back off the strings the wire carries. An id is the kind
 * it is written with, a `|`, and a dotted address; a behaviour hangs under
 * its building block, a building block and a submodule under their module,
 * and a root module under nothing.
 */

const MODULE = 'module|';
const BUILDING_BLOCK = 'building_block|';
const BEHAVIOUR = 'behavior|';

/** An id's address: its dotted path, without the kind it is written with. */
export const addressOf = (id: string) => id.slice(id.indexOf('|') + 1);

const parentAddressOf = (id: string) => {
  const address = addressOf(id);
  return address.slice(0, Math.max(0, address.lastIndexOf('.')));
};

/** The element's own name: `PaymentHold`, never `scheduling.payments.PaymentHold`. */
export const nameOf = (id: string) => addressOf(id).split('.').at(-1) ?? id;

const isBuildingBlock = (id: string) => id.startsWith(BUILDING_BLOCK);

/** The id a type reference names, a collection by its item. */
export const refIdOf = (ref: BuildingBlockRefInput): string =>
  typeof ref === 'string' ? ref : refIdOf(ref.collectionOf);

/** The building block a type reference names, through any collection; null for a primitive. */
export function blockOfRef(ref: BuildingBlockRefInput): string | null {
  const id = refIdOf(ref);
  return isBuildingBlock(id) ? id : null;
}

/** What an id names; anything that is neither a behaviour nor a building block is a module. */
export function kindOf(
  id: string,
): Extract<OutlineKind, 'module' | 'building_block' | 'behaviour'> {
  if (id.startsWith(BEHAVIOUR)) return 'behaviour';
  if (isBuildingBlock(id)) return 'building_block';
  return 'module';
}

/** The building block a behaviour is on. */
export const ownerOf = (behaviourId: string) =>
  `${BUILDING_BLOCK}${parentAddressOf(behaviourId)}`;

/** The module a building block sits in, or a behaviour's building block does. */
export const moduleOf = (elementId: string) =>
  `${MODULE}${parentAddressOf(
    isBuildingBlock(elementId) ? elementId : ownerOf(elementId),
  )}`;

/** What an element hangs under; null for a root module. */
export function parentOf(id: string): string | null {
  if (!addressOf(id).includes('.')) return null;
  return kindOf(id) === 'behaviour'
    ? ownerOf(id)
    : `${MODULE}${parentAddressOf(id)}`;
}
