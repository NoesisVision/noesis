import type {
  DesignDocumentInput,
  DesignedRelationInput,
  DesignedRelationKeyInput,
} from '#backend/app/design-docs/design-doc.ts';
import type { Cardinality } from '#backend/app/system-model/system-model.ts';
import type { ChangeSetInput } from './change-set.ts';

/*
 * The relations of a design document, read from one end. The document keeps
 * them in one change set; a reader wants the state of a block, the inputs of
 * a behavior, what a block extends — each the relations of one kind from one
 * element — and names them as the parts they were: a property, an input, an
 * output, an extended type.
 */

/** The parts of an element that are relations, by the kind the model gives each. */
export const RELATION_KIND_OF = {
  property: 'has_state',
  parameter: 'has_input',
  result: 'has_output',
  extends: 'extends',
} as const;
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

/** A relation as the document writes it, or the key it removes one by. */
export type RelationLike = {
  kind: string;
  from: string;
  to?: unknown;
  name?: string;
  /** A parameter's place in its signature, as a field. */
  position?: unknown;
};

/** Named slots are unique by their holder and name; every other relation by its ends. */
const NAMED_SLOTS: ReadonlySet<string> = new Set(['has_state', 'has_input']);

/** The key the server knows a relation by: `kind|from|#name` for a named slot, `kind|from|to` otherwise. */
export const relationKeyOf = (relation: RelationLike): string =>
  NAMED_SLOTS.has(relation.kind)
    ? `${relation.kind}|${relation.from}|#${relation.name}`
    : `${relation.kind}|${relation.from}|${String(relation.to)}`;

/** The key a part of an element has as a relation: a named slot by its name, the rest by their target. */
export const relationKeyOfPart = (
  kind: RelationPartKind,
  owner: string,
  id: string,
): string =>
  relationKeyOf(
    kind === 'property' || kind === 'parameter'
      ? { kind: RELATION_KIND_OF[kind], from: owner, name: id }
      : { kind: RELATION_KIND_OF[kind], from: owner, to: id },
  );

/** The key a relation part is removed by. */
export const removalKeyOfPart = (
  kind: RelationPartKind,
  owner: string,
  id: string,
): DesignedRelationKeyInput =>
  kind === 'property' || kind === 'parameter'
    ? { kind: RELATION_KIND_OF[kind], from: owner, name: id }
    : ({ kind: RELATION_KIND_OF[kind], from: owner, to: id } as KeyOf<
        'has_output' | 'extends'
      >);

type PartsOf = {
  property: ChangeSetInput<DesignedStateInput, KeyOf<'has_state'>>;
  parameter: ChangeSetInput<DesignedInputInput, KeyOf<'has_input'>>;
  result: ChangeSetInput<DesignedOutputInput, KeyOf<'has_output'>>;
  extends: ChangeSetInput<DesignedExtendsInput, KeyOf<'extends'>>;
};

/**
 * The relations of one kind from one element, as the change set of that
 * element's parts: a block's state, a behavior's inputs, its output, what a
 * block extends.
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

/**
 * Where a parameter stands in its signature, as the design writes it; a
 * parameter whose position the design keeps unsaid, or anything that is no
 * parameter, keeps its place in the list.
 */
const positionOf = ({ position }: RelationLike): number =>
  typeof position === 'object' &&
  position !== null &&
  'value' in position &&
  typeof position.value === 'number'
    ? position.value
    : Number.MAX_SAFE_INTEGER;

/** The relations of one kind that end at an element: what extends a block, what calls a behavior. */
export function relationsTo<Kind extends RelationPartKind>(
  doc: DesignDocumentInput,
  kind: Kind,
  target: string,
): PartsOf[Kind] {
  const relationKind = RELATION_KIND_OF[kind];
  const to = <Item extends RelationLike>(items: Item[] | undefined) =>
    (items ?? []).filter(
      (item) => item.kind === relationKind && item.to === target,
    );
  return {
    added: to(doc.relations?.added),
    modified: to(doc.relations?.modified),
    removed: to(doc.relations?.removed),
  } as unknown as PartsOf[Kind];
}

export const CARDINALITIES = [
  '1',
  '0..1',
  '0..*',
  '1..*',
] as const satisfies readonly Cardinality[];

/** How a cardinality reads after a type: nothing for exactly one, `[0..*]` otherwise. */
export const cardinalitySuffixOf = (cardinality: string | null): string =>
  cardinality === null || cardinality === '1' ? '' : ` [${cardinality}]`;
