import type {
  DesignDocumentInput,
  DesignedRelationInput,
  DesignedRelationKeyInput,
} from '#backend/app/design-docs/design-doc.ts';
import {
  NAMED_SLOT_KINDS,
  type RelationKey,
  relationKeyOf,
} from '#backend/app/design-docs/relation-key.ts';
import type { Cardinality } from '#backend/app/system-model/system-model.ts';
import type { ChangeSetInput } from './change-set.ts';

/*
 * The relations of a design document, read from one end. The document keeps
 * them in one change set; a reader wants the state of a block, what it works
 * with, the inputs of a behavior, what a block extends — each the relations
 * of one kind from one element — and names them as the parts they were: a
 * property, a collaborator, an input, an output, an extended type.
 */

/** The parts of an element that are relations, by the kind the model gives each. */
export const RELATION_KIND_OF = {
  property: 'has_state',
  collaborator: 'has_collaborator',
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
export type DesignedCollaboratorInput = RelationOf<'has_collaborator'>;
export type DesignedInputInput = RelationOf<'has_input'>;
export type DesignedOutputInput = RelationOf<'has_output'>;
export type DesignedExtendsInput = RelationOf<'extends'>;

/** A relation as the document writes it, or the key it removes one by; a parameter's place in its signature is a field. */
export type RelationLike = RelationKey & { position?: unknown };

export { relationKeyOf };

/** The parts known by their name rather than by what they point at: the model's named slots. */
export const isNamedPart = (kind: RelationPartKind) =>
  NAMED_SLOT_KINDS.has(RELATION_KIND_OF[kind]);

/** The key a part of an element has as a relation: a named slot by its name, the rest by their target. */
export const relationKeyOfPart = (
  kind: RelationPartKind,
  owner: string,
  id: string,
): string =>
  relationKeyOf(
    isNamedPart(kind)
      ? { kind: RELATION_KIND_OF[kind], from: owner, name: id }
      : { kind: RELATION_KIND_OF[kind], from: owner, to: id },
  );

/** The key a relation part is removed by: a named slot carries its type too, as the model has it. */
export const removalKeyOfPart = (
  kind: RelationPartKind,
  owner: string,
  id: string,
  to: string,
): DesignedRelationKeyInput =>
  isNamedPart(kind)
    ? ({ kind: RELATION_KIND_OF[kind], from: owner, to, name: id } as KeyOf<
        'has_state' | 'has_collaborator' | 'has_input' | 'has_output'
      >)
    : ({
        kind: RELATION_KIND_OF[kind],
        from: owner,
        to: id,
      } as KeyOf<'extends'>);

type PartsOf = {
  property: ChangeSetInput<DesignedStateInput, KeyOf<'has_state'>>;
  collaborator: ChangeSetInput<
    DesignedCollaboratorInput,
    KeyOf<'has_collaborator'>
  >;
  parameter: ChangeSetInput<DesignedInputInput, KeyOf<'has_input'>>;
  result: ChangeSetInput<DesignedOutputInput, KeyOf<'has_output'>>;
  extends: ChangeSetInput<DesignedExtendsInput, KeyOf<'extends'>>;
};

/**
 * The relations of one kind from one element, as the change set of that
 * element's parts: a block's state, what it works with, a behavior's
 * inputs, its output, what a block extends.
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
      (item) =>
        item.kind === relationKind && 'to' in item && item.to === target,
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
