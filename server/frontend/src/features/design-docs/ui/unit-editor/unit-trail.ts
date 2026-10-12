import type { UnitRef, UnitTarget } from '../../design-doc-edit.ts';
import { addressOf } from '../../element-id.ts';

/*
 * The trail over a modal is the one the details view shows: the element's
 * address, step by step — a part is shown in its element's view, so its
 * trail is that element's. A need sits in no element: it has none.
 */

const stepsOf = (id: string) => addressOf(id).split('.');

/** The element a unit is shown in: the unit itself, or the one it is part of. */
export function trailOfRef(ref: UnitRef): string[] {
  if ('owner' in ref) return stepsOf(ref.owner.id);
  return ref.kind === 'need' ? [] : stepsOf(ref.id);
}

/** The element a form writes in: the unit edited, or where one is added. */
export function trailOfTarget(target: UnitTarget): string[] {
  if (target.mode === 'edit') return trailOfRef(target.ref);
  if ('owner' in target) return stepsOf(target.owner.id);
  return target.kind === 'need' || target.parent === null
    ? []
    : stepsOf(target.parent);
}
