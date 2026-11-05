import type {
  DesignDocumentInput,
  DesignedRelationInput,
  DesignedRelationKeyInput,
} from '#backend/app/design-docs/design-doc.ts';
import type { Cardinality } from '#backend/app/system-model/system-model.ts';
import type { ChangeSetInput } from './change-set.ts';
import { valueOf } from './design-doc-field.ts';
import { nameOf } from './element-id.ts';

/*
 * The relations of a design document, read from one end. The document keeps
 * them in one change set; a reader wants the state of a block, the inputs of
 * a behavior, what a block extends — each the relations of one kind from one
 * element — and names them as the parts they were: a property, an input, an
 * output, an extended type.
 *
 * The page may not run backend code, so the vocabulary the server reads off
 * its schemas is spelled here once more, each list checked against the
 * contract's type.
 */

/** The parts of an element that are relations, by the kind the model gives each. */
export const RELATION_KIND_OF = {
  property: 'has_state',
  parameter: 'has_input',
  result: 'has_output',
  extends: 'extends',
} as const satisfies Record<string, DesignedRelationInput['kind']>;
export type RelationPartKind = keyof typeof RELATION_KIND_OF;

type RelationOf<Kind extends DesignedRelationInput['kind']> = Extract<
  DesignedRelationInput,
  { kind: Kind }
>;
type KeyOf<Kind extends DesignedRelationKeyInput['kind']> = Extract<
  DesignedRelationKeyInput,
  { kind: Kind }
>;

export type DesignedStateInput = RelationOf<'has_state'>;
export type DesignedInputInput = RelationOf<'has_input'>;
export type DesignedOutputInput = RelationOf<'has_output'>;
export type DesignedExtendsInput = RelationOf<'extends'>;

/** What a behavior's output is named, as the server's `OUTPUT_NAME`. */
export const OUTPUT_NAME = 'result' satisfies DesignedOutputInput['name'];

/** A relation as the document writes it, or the key it removes one by. */
export interface RelationLike {
  kind: string;
  from: string;
  to?: unknown;
  name?: string;
  /** A parameter's place in its signature, as a field. */
  position?: unknown;
}

/** The named slots, as the server's `NAMED_SLOT_KINDS`: unique by their holder and name. */
const NAMED_SLOT_KINDS: ReadonlySet<string> = new Set([
  'has_state',
  'has_input',
  'has_output',
] satisfies DesignedRelationInput['kind'][]);

/** The relations that place an element under another: the tree of modules, blocks and behaviors. */
export const CONTAINMENT_KINDS: ReadonlySet<string> = new Set([
  'module_contains_module',
  'module_contains_block',
  'exposes',
] satisfies DesignedRelationInput['kind'][]);

/** The key the server knows a relation by, as its `relationKeyOf`: `kind|from|#name` for a named slot, `kind|from|to` otherwise. */
export const relationKeyOf = (relation: RelationLike): string =>
  NAMED_SLOT_KINDS.has(relation.kind) && relation.name !== undefined
    ? `${relation.kind}|${relation.from}|#${relation.name}`
    : `${relation.kind}|${relation.from}|${String(relation.to)}`;

/** Whether an item of a change set is a relation, or the key one is removed by. */
export const isRelation = (item: unknown): item is RelationLike =>
  typeof item === 'object' &&
  item !== null &&
  'kind' in item &&
  typeof item.kind === 'string' &&
  'from' in item &&
  typeof item.from === 'string';

/** A part's relation as far as its key goes: a named slot by its name, an extended type by its target. */
const relationOfPart = (
  kind: RelationPartKind,
  owner: string,
  id: string,
): RelationLike =>
  kind === 'extends'
    ? { kind: RELATION_KIND_OF[kind], from: owner, to: id }
    : { kind: RELATION_KIND_OF[kind], from: owner, name: id };

/** The key a part of an element has as a relation. */
export const relationKeyOfPart = (
  kind: RelationPartKind,
  owner: string,
  id: string,
): string => relationKeyOf(relationOfPart(kind, owner, id));

/** A slot's type as the relation writes it: the field's value, or the target itself on a key. */
export const typeOf = (relation: RelationLike): string | null => {
  const { to } = relation;
  if (typeof to === 'string') return to;
  const value = valueOf(to as { value: unknown } | undefined);
  return typeof value === 'string' ? value : null;
};

type PartsOf = {
  property: ChangeSetInput<DesignedStateInput, KeyOf<'has_state'>>;
  parameter: ChangeSetInput<DesignedInputInput, KeyOf<'has_input'>>;
  result: ChangeSetInput<DesignedOutputInput, KeyOf<'has_output'>>;
  extends: ChangeSetInput<DesignedExtendsInput, KeyOf<'extends'>>;
};

/**
 * The relations of one kind from one element, as the change set of that
 * element's parts: a block's state, a behavior's inputs in the order of its
 * signature, its output, what a block extends.
 */
export function relationsFrom<Kind extends RelationPartKind>(
  doc: DesignDocumentInput,
  kind: Kind,
  owner: string,
): PartsOf[Kind] {
  const relationKind = RELATION_KIND_OF[kind];
  const from = <Item extends RelationLike>(items: Item[] | undefined) =>
    (items ?? [])
      .filter((item) => item.kind === relationKind && item.from === owner)
      .sort((a, b) => positionOf(a) - positionOf(b));
  return {
    added: from(doc.relations?.added),
    modified: from(doc.relations?.modified),
    removed: from(doc.relations?.removed),
  } as unknown as PartsOf[Kind];
}

/** The relations of one kind that end at an element: what extends a block. */
export function relationsTo<Kind extends RelationPartKind>(
  doc: DesignDocumentInput,
  kind: Kind,
  target: string,
): PartsOf[Kind] {
  const relationKind = RELATION_KIND_OF[kind];
  const to = <Item extends RelationLike>(items: Item[] | undefined) =>
    (items ?? []).filter(
      (item) => item.kind === relationKind && typeOf(item) === target,
    );
  return {
    added: to(doc.relations?.added),
    modified: to(doc.relations?.modified),
    removed: to(doc.relations?.removed),
  } as unknown as PartsOf[Kind];
}

/**
 * Where a parameter stands in its signature, as the design writes it; a
 * parameter whose position the design keeps unsaid, or anything that is no
 * parameter, keeps its place in the list.
 */
const positionOf = ({ position }: RelationLike): number => {
  const value = valueOf(position as { value: unknown } | undefined);
  return typeof value === 'number' ? value : Number.MAX_SAFE_INTEGER;
};

/** How many values a slot may hold, in the order a select offers them. */
export const CARDINALITIES = [
  '1',
  '0..1',
  '*',
] as const satisfies readonly Cardinality[];

/** How a cardinality reads after a type: nothing for exactly one, `[*]` or `[0..1]` otherwise. */
export const cardinalitySuffixOf = (cardinality: string | null): string =>
  cardinality === null || cardinality === '1' ? '' : ` [${cardinality}]`;

/**
 * A slot's type in words — a building block by its own name, a primitive by
 * the primitive — with how many it holds after it when not exactly one:
 * `RefundLine [*]`, `date [0..1]`.
 */
export const slotLabelOf = (type: string, cardinality: string | null): string =>
  `${nameOf(type)}${cardinalitySuffixOf(cardinality)}`;
