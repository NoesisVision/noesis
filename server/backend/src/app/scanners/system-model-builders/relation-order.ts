import type { Relation } from '#backend/app/system-model/system-model';

/**
 * The order the model lists its relations in: by kind, holder, position,
 * target, then name or order, so two builds give one file and a signature
 * reads in its order.
 */
export const byRelation = (a: Relation, b: Relation): number =>
  byCodeUnit(a.kind, b.kind) ||
  byCodeUnit(a.from, b.from) ||
  positionOf(a) - positionOf(b) ||
  byCodeUnit(a.to, b.to) ||
  byCodeUnit(nameOf(a), nameOf(b)) ||
  orderOf(a) - orderOf(b);

const nameOf = (relation: Relation) =>
  'name' in relation ? relation.name : '';

const orderOf = (relation: Relation) =>
  'order' in relation ? relation.order : 0;

const positionOf = (relation: Relation) =>
  'position' in relation ? relation.position : 0;

/** Ids are ASCII, so code-unit order is alphabetical without a locale. */
const byCodeUnit = (a: string, b: string) => (a < b ? -1 : a > b ? 1 : 0);
