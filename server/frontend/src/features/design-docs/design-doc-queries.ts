import { isElementId, isWithin, nameOf } from '#/shared/model/element-id.ts';
import type { DesignDocumentInput } from '#backend/app/design-docs/design-doc.ts';
import { writtenIn } from './change-set.ts';
import { fieldOf, keysOf, topSetOf, unitOf } from './design-doc-change-sets.ts';
import { valueOf } from './design-doc-field.ts';
import {
  CONTAINED_KINDS,
  isPart,
  type PartOwner,
  type UnitRef,
} from './design-doc-unit.ts';
import { type RelationLike, typeOf } from './relations.ts';
import { rulesUnder } from './rules.ts';

/*
 * What a design says about a unit, without changing it: its name, what it
 * holds, the rules that trace to it.
 */

/** A unit by the name a reader knows it by. */
export function unitNameOf(doc: DesignDocumentInput, ref: UnitRef): string {
  switch (ref.kind) {
    case 'need': {
      const need = unitOf(doc, ref);
      const name = need === null ? null : valueOf(fieldOf(need, 'name'));
      return typeof name === 'string' ? name : ref.id;
    }
    case 'rule':
    case 'scenario': {
      const unit = unitOf(doc, ref);
      const name = unit === null ? null : valueOf(fieldOf(unit, 'name'));
      return typeof name === 'string' ? name : nameOf(ref.id);
    }
    case 'module':
    case 'building_block':
    case 'behavior':
    case 'actor':
    case 'manual_process':
    case 'extends':
      return nameOf(ref.id);
    case 'result': {
      const output = unitOf(doc, ref);
      const type = output === null ? null : typeOf(output as RelationLike);
      return type === null ? ref.id : nameOf(type);
    }
    default:
      return ref.id;
  }
}

/** The names of the rules that answer a need, which lose it when it goes. */
export function rulesTracing(
  doc: DesignDocumentInput,
  needId: string,
): string[] {
  return writtenIn(doc.rules)
    .filter((rule) => (valueOf(rule.needs) ?? []).includes(needId))
    .map((rule) => valueOf(rule.name) ?? nameOf(rule.id));
}

/**
 * What the design writes under a unit, which goes with it: the elements under
 * an element, the scenarios of a rule.
 */
export function unitsWithin(doc: DesignDocumentInput, ref: UnitRef): number {
  if (!isElementId(ref.id) || (isPart(ref.kind) && ref.kind !== 'rule'))
    return 0;
  return CONTAINED_KINDS.flatMap((kind) => keysOf(topSetOf(doc, kind))).filter(
    (id) => id !== ref.id && isWithin(id, ref.id),
  ).length;
}

/** The ids of the rules the design shows under an element: added, then modified. */
export const rulesOf = (doc: DesignDocumentInput, owner: PartOwner): string[] =>
  writtenIn(rulesUnder(doc, owner.id)).map(({ id }) => id);
