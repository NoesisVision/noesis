import type {
  BehaviorType,
  BuildingBlockType,
} from '#backend/app/system-model/system-model';
import type { Language, NodeId } from '../code-parsers/code-model';

/*
 * What the system model builder knows about one language: which annotation types mean
 * what, which platform types are the model's primitives, which hold
 * collections. Everything the builder does with an annotation goes through
 * a role, so a second language is a second table, not a second builder.
 * See docs/plans/code-model-to-system-model.md, section 2.
 */

/** The model's built-in types, the part after `primitive|`. */
export type PrimitiveName =
  | 'string'
  | 'integer'
  | 'decimal'
  | 'boolean'
  | 'date'
  | 'datetime'
  | 'duration'
  | 'uuid';

export type AnnotationRole =
  /** The type is a building block of `type`; the `name` argument overrides its name. */
  | { readonly role: 'buildingBlock'; readonly type: BuildingBlockType }
  /** The method is a behavior; `name` overrides its name, `triggeredBy` fixes its type, or the role's own `type` does (Java's `@QueryHandler`). */
  | { readonly role: 'behavior'; readonly type?: BehaviorType }
  /** Who calls the behavior: the `name` argument. */
  | { readonly role: 'actor' }
  /** The element's description, Markdown, in the `description` argument. */
  | { readonly role: 'description' }
  /** A scenario of the block or behavior, by its `name` only. */
  | { readonly role: 'scenario' }
  /** The element is not in the system model. */
  | { readonly role: 'exclude' };

/** The argument names the roles read. */
interface RoleArguments {
  readonly name: string;
  readonly description: string;
  readonly triggeredBy: string;
}

export interface AnnotationVocabulary {
  readonly language: Language;
  /** Roles by the annotation type's node or stub id, e.g. `T:NoesisVision.Annotations.Domain.DDD.DddAggregateAttribute`. */
  readonly roles: ReadonlyMap<NodeId, AnnotationRole>;
  readonly arguments: RoleArguments;
  /** `PrimitiveTypeRef.name`s and platform type ids that are the model's primitives. */
  readonly primitives: ReadonlyMap<string, PrimitiveName>;
  /** Type ids whose first type argument is the element of a collection. */
  readonly collections: ReadonlySet<NodeId>;
  /** Type ids of key-value collections; the model cannot express them yet. */
  readonly dictionaries: ReadonlySet<NodeId>;
  /** Type ids the builder looks through to their type argument (`Task<T>`). */
  readonly wrappers: ReadonlySet<NodeId>;
  /** Type ids that mark their type argument optional (`Nullable<T>`). */
  readonly optionalWrappers: ReadonlySet<NodeId>;
  /** Non-generic type ids that stand for no value (`Task`). */
  readonly voidTypes: ReadonlySet<NodeId>;
  /** Method names never taken for behaviors (`Equals`, `ToString`, ...). */
  readonly technicalMembers: ReadonlySet<string>;
}
