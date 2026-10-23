import type { BuildingBlockId } from '#backend/app/element-id';
import {
  type BuildingBlockRef,
  PrimitiveId,
} from '#backend/app/system-model/system-model';
import type { NodeId, TypeRef } from '../code-model';
import type { CodeModelIndex, IndexedArtifact } from './code-model-index';
import type { AnnotationVocabulary } from './vocabulary';

/*
 * A type reference resolved to what the system model can reference: a
 * building block, one of the model's primitives, or a collection of either.
 * Section 7 of docs/plans/code-model-to-system-model.md gives the rules and
 * their order; anything they do not cover resolves to nothing and the caller
 * leaves the member out.
 */

export interface ResolvedType {
  readonly ref: BuildingBlockRef;
  /** Whether the reference was nullable or wrapped in `Nullable<T>`. */
  readonly optional: boolean;
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
}

export function resolveTypeRef(
  ref: TypeRef,
  scope: ResolutionScope,
): ResolvedType | null {
  return resolve(ref, scope, new Set());
}

/** `visiting` holds the type parameters being resolved, so `T : IComparable<T>` ends. */
function resolve(
  ref: TypeRef,
  scope: ResolutionScope,
  visiting: Set<string>,
): ResolvedType | null {
  const { vocabulary } = scope;
  switch (ref.kind) {
    case 'primitive': {
      const primitive = vocabulary.primitives.get(ref.name);
      return primitive === undefined
        ? null
        : { ref: primitiveRef(primitive), optional: ref.nullable };
    }
    case 'array': {
      const element = resolve(ref.element, scope, visiting);
      return element === null
        ? null
        : { ref: { collectionOf: element.ref }, optional: ref.nullable };
    }
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
): ResolvedType | null {
  const { vocabulary } = scope;
  const [first] = ref.typeArguments;
  if (vocabulary.wrappers.has(ref.type)) {
    const inner = first === undefined ? null : resolve(first, scope, visiting);
    return inner === null
      ? null
      : { ref: inner.ref, optional: inner.optional || ref.nullable };
  }
  if (vocabulary.optionalWrappers.has(ref.type)) {
    const inner = first === undefined ? null : resolve(first, scope, visiting);
    return inner === null ? null : { ref: inner.ref, optional: true };
  }
  if (vocabulary.voidTypes.has(ref.type)) return null;
  const primitive = vocabulary.primitives.get(ref.type);
  if (primitive !== undefined) {
    return { ref: primitiveRef(primitive), optional: ref.nullable };
  }
  if (vocabulary.collections.has(ref.type)) {
    const element =
      first === undefined ? null : resolve(first, scope, visiting);
    return element === null
      ? null
      : { ref: { collectionOf: element.ref }, optional: ref.nullable };
  }
  if (vocabulary.dictionaries.has(ref.type)) {
    scope.unresolvable?.(
      `${ref.type} is a collection of key-value pairs, which the system model cannot express`,
    );
    return null;
  }
  const block = scope.blockOf(scope.from, ref.type);
  if (block !== null) return { ref: block, optional: ref.nullable };
  return lookThrough(ref, scope, visiting);
}

/** An unmapped generic resolves as its one resolving type argument (`Result<Order>`). */
function lookThrough(
  ref: Extract<TypeRef, { kind: 'named' }>,
  scope: ResolutionScope,
  visiting: Set<string>,
): ResolvedType | null {
  const resolved = ref.typeArguments
    .map((argument) => resolve(argument, scope, visiting))
    .filter((argument): argument is ResolvedType => argument !== null);
  const [only] = resolved;
  return resolved.length === 1 && only !== undefined
    ? { ref: only.ref, optional: only.optional || ref.nullable }
    : null;
}

/** A type parameter resolves through its one resolving `type` constraint (`T : Entity`). */
function resolveTypeParameter(
  ref: Extract<TypeRef, { kind: 'typeParameter' }>,
  scope: ResolutionScope,
  visiting: Set<string>,
): ResolvedType | null {
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
    ? { ref: only.ref, optional: only.optional || ref.nullable }
    : null;
}

function primitiveRef(name: string): PrimitiveId {
  return PrimitiveId.parse(`primitive|${name}`);
}
