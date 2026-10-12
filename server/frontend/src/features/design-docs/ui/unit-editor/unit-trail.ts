import type { UnitRef, UnitTarget } from '../../design-doc-edit.ts';
import { addressOf } from '../../element-id.ts';

/*
 * The trail over a modal: what holds the element the modal is about, step by
 * step — the element itself is the modal's subject, so the trail stops above
 * it. A part is about its element; a need sits in no element and has none.
 */

const above = (id: string) => addressOf(id).split('.').slice(0, -1);

/** What holds the element a unit is shown in: its own, or its owner's. */
export function trailOfRef(ref: UnitRef): string[] {
  if ('owner' in ref) return above(ref.owner.id);
  return ref.kind === 'need' ? [] : above(ref.id);
}

/** What holds the element a form writes in: the unit edited, or where one is added. */
export function trailOfTarget(target: UnitTarget): string[] {
  if (target.mode === 'edit') return trailOfRef(target.ref);
  if ('owner' in target) return above(target.owner.id);
  return target.kind === 'need' || target.parent === null
    ? []
    : addressOf(target.parent).split('.');
}
