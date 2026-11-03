import type { BuildingBlockId } from '#backend/app/element-id';
import {
  type Cardinality,
  PrimitiveId,
  type TypeId,
} from '#backend/app/system-model/system-model';
import type { NodeId, TypeRef } from '../code-parsers/code-model';
import type { CodeModelIndex, IndexedArtifact } from './code-model-index';
import type { AnnotationVocabulary } from './vocabulary';

/*
 * A type reference resolved to what the system model can reference: a
 * building block or one of the model's primitives, with the cardinality the
 * reference implies — a collection, an optional value, or exactly one.
 * Section 7 of docs/plans/code-model-to-system-model.md gives the rules and
 * their order; anything they do not cover resolves to nothing and the caller
 * leaves the member out.
 */

export interface ResolvedType {
  readonly ref: TypeId;
  readonly cardinality: Cardinality;
}

export interface ResolutionScope {
  readonly vocabulary: AnnotationVocabulary;
  readonly index: CodeModelIndex;
  /** The artifact the reference is read from; ids are looked up from it. */
  readonly from: IndexedArtifact;
  /** The block `typeId` names, from `from`; null when it is no block. */
  blockOf(from: IndexedArtifact, typeId: NodeId): BuildingBlockId | null;
  /** Told why a reference resolved to nothing when the model has no word for it. */
  unresolvable?(reason: string): void;
  /** Told when a collection of collections was read as one collection of the innermost element. */
  flattened?(reason: string): void;
}

/** What a reference says before it is read as a cardinality. */
interface Resolved {
  readonly ref: TypeId;
  /** Whether the reference was nullable or wrapped in `Nullable<T>` or `Optional<T>`. */
  readonly optional: boolean;
  /** How many collections wrap the element: `List<Order>` is 1, `List<List<Order>>` 2. */
  readonly collections: number;
}

export function resolveTypeRef(
  ref: TypeRef,
  scope: ResolutionScope,
): ResolvedType | null {
  const resolved = resolve(ref, scope, new Set());
  if (resolved === null) return null;
  if (resolved.collections > 1) {
    scope.flattened?.(
      `a collection of collections is read as one collection of ${resolved.ref}`,
    );
  }
  return { ref: resolved.ref, cardinality: cardinalityOf(resolved) };
}

/** The cardinality with the value made optional: a parameter with a default. */
export function optionalOf(cardinality: Cardinality): Cardinality {
  return cardinality === '1' ? '0..1' : cardinality;
}

/** A collection, however nested, holds any number; a nullable value one or none; else exactly one. */
function cardinalityOf({ optional, collections }: Resolved): Cardinality {
  if (collections > 0) return '0..*';
  return optional ? '0..1' : '1';
}

/** `visiting` holds the type parameters being resolved, so `T : IComparable<T>` ends. */
function resolve(
  ref: TypeRef,
  scope: ResolutionScope,
  visiting: Set<string>,
): Resolved | null {
  const { vocabulary } = scope;
  switch (ref.kind) {
    case 'primitive': {
      const primitive = vocabulary.primitives.get(ref.name);
      return primitive === undefined
        ? null
        : single(primitiveRef(primitive), ref.nullable);
    }
    case 'array':
      return collectionOf(resolve(ref.element, scope, visiting));
    case 'typeParameter':
      return resolveTypeParameter(ref, scope, visiting);
    case 'named':
      return resolveNamed(ref, scope, visiting);
    default:
      return null;
  }
}

function resolveNamed(
  ref: Extract<TypeRef, { kind: 'named' }>,
  scope: ResolutionScope,
  visiting: Set<string>,
): Resolved | null {
  const { vocabulary } = scope;
  const [first] = ref.typeArguments;
  const inner = () =>
    first === undefined ? null : resolve(first, scope, visiting);
  if (vocabulary.wrappers.has(ref.type)) {
    return withNullable(inner(), ref.nullable);
  }
  if (vocabulary.optionalWrappers.has(ref.type)) {
    return withNullable(inner(), true);
  }
  if (vocabulary.voidTypes.has(ref.type)) return null;
  const primitive = vocabulary.primitives.get(ref.type);
  if (primitive !== undefined) {
    return single(primitiveRef(primitive), ref.nullable);
  }
  if (vocabulary.collections.has(ref.type)) return collectionOf(inner());
  if (vocabulary.dictionaries.has(ref.type)) {
    scope.unresolvable?.(
      `${ref.type} is a collection of key-value pairs, which the system model cannot express`,
    );
    return null;
  }
  const block = scope.blockOf(scope.from, ref.type);
  if (block !== null) return single(block, ref.nullable);
  return lookThrough(ref, scope, visiting);
}

/** An unmapped generic resolves as its one resolving type argument (`Result<Order>`). */
function lookThrough(
  ref: Extract<TypeRef, { kind: 'named' }>,
  scope: ResolutionScope,
  visiting: Set<string>,
): Resolved | null {
  const resolved = ref.typeArguments
    .map((argument) => resolve(argument, scope, visiting))
    .filter((argument): argument is Resolved => argument !== null);
  const [only] = resolved;
  return resolved.length === 1 && only !== undefined
    ? withNullable(only, ref.nullable)
    : null;
}

/** A type parameter resolves through its one resolving `type` constraint (`T : Entity`). */
function resolveTypeParameter(
  ref: Extract<TypeRef, { kind: 'typeParameter' }>,
  scope: ResolutionScope,
  visiting: Set<string>,
): Resolved | null {
  const key = `${ref.owner}#${ref.ordinal}`;
  if (visiting.has(key)) return null;
  const owner = scope.index.resolve(scope.from, ref.owner);
  if (owner === null || owner.node.kind === 'namespace') return null;
  const parameter =
    owner.node.kind === 'type' || owner.node.kind === 'method'
      ? owner.node.typeParameters.find((p) => p.ordinal === ref.ordinal)
      : undefined;
  if (parameter === undefined) return null;
  visiting.add(key);
  const resolved = parameter.constraints.flatMap((constraint) => {
    if (constraint.kind !== 'type') return [];
    const result = resolve(
      constraint.type,
      { ...scope, from: owner.artifact },
      visiting,
    );
    return result === null ? [] : [result];
  });
  visiting.delete(key);
  const [only] = resolved;
  return resolved.length === 1 && only !== undefined
    ? withNullable(only, ref.nullable)
    : null;
}

function single(ref: TypeId, optional: boolean): Resolved {
  return { ref, optional, collections: 0 };
}

function withNullable(
  resolved: Resolved | null,
  nullable: boolean,
): Resolved | null {
  return resolved === null
    ? null
    : { ...resolved, optional: resolved.optional || nullable };
}

/** A collection of an element that resolves to nothing resolves to nothing. */
function collectionOf(element: Resolved | null): Resolved | null {
  return element === null
    ? null
    : { ...element, collections: element.collections + 1 };
}

function primitiveRef(name: string): PrimitiveId {
  return PrimitiveId.parse(`primitive|${name}`);
}
