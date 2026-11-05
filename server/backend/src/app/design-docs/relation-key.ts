import { Relation } from '#backend/app/system-model/system-model';

/** What a relation is keyed by: its kind and holder, then its `to` for an edge, or its name for a named slot. */
export type RelationKey =
  | { readonly kind: string; readonly from: string; readonly to: unknown }
  | { readonly kind: string; readonly from: string; readonly name: string };

/** The named slots, read off the schemas: every relation kind whose shape has a `name`. */
export const NAMED_SLOT_KINDS: ReadonlySet<string> = new Set(
  Relation.options
    .filter((option) => 'name' in option.shape)
    .map((option) => option.shape.kind.value),
);

/** The key a relation is unique by: `kind|from|to`, or `kind|from|#name` for a named slot. */
export const relationKeyOf = (relation: RelationKey): string =>
  NAMED_SLOT_KINDS.has(relation.kind) && 'name' in relation
    ? `${relation.kind}|${relation.from}|#${relation.name}`
    : `${relation.kind}|${relation.from}|${'to' in relation ? String(relation.to) : ''}`;
