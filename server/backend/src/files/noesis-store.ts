import type { z } from 'zod';

/**
 * `NoesisStore`: the contract of the one door to `.noesis/graph/`
 * (decision 76). This file holds the types and the error; an implementation
 * (`bun-noesis-store.ts`) supplies the factory.
 *
 * A collection is a directory of objects, one directory per object named by
 * its key, holding exactly one `data.json` plus the directories of its child
 * collections. The same shape repeats at every depth, so a change owns its
 * design documents the way the root owns changes:
 *
 * ```text
 * changes/<slug>/data.json
 * changes/<slug>/design-docs/<id>/data.json
 * ```
 *
 * The store validates with the collection's Zod schema on both sides of the
 * disk, replaces `data.json` atomically by rename, never reads a child when
 * reading its parent and never parses a file when listing keys. It has no
 * locks and no coordinator: the last complete write wins, across processes
 * too, because the rename is the whole guarantee.
 *
 * A directory under a collection without `data.json` is not an object: it is
 * garbage from an interrupted write or deletion. `keys()` skips it, `get`
 * answers `null` for it and `delete` removes it.
 */

/** The one file an object directory holds. */
export const DATA_FILE_NAME = 'data.json';

/** What an object key may look like; rejected before any disk access. */
export const KEY_PATTERN = /^[a-z0-9][a-z0-9_-]{0,127}$/;

/** What a child collection name may look like; checked by the factory. */
export const COLLECTION_NAME_PATTERN = /^[A-Za-z][A-Za-z0-9_-]{0,63}$/;

// ---------------------------------------------------------------------------
// Definitions
// ---------------------------------------------------------------------------

/** A child collection: a schema alone for a leaf, or a nested definition. */
export type ChildDefinition = z.ZodType | NestedDefinition;

export interface NestedDefinition {
  schema: z.ZodType;
  children?: ChildDefinitions;
}

export type ChildDefinitions = { readonly [name: string]: ChildDefinition };

export interface NoesisStoreOptions<
  S extends z.ZodType,
  C extends ChildDefinitions,
> {
  /** The root collection directory; resolved to an absolute path once. */
  directory: string;
  /** The schema every object of the collection satisfies. */
  schema: S;
  /** Child collections, by name; their directories derive from the parent's. */
  children?: C;
}

/** The typed handles `children(key)` returns for a definition's children. */
export type ChildHandles<C> = C extends ChildDefinitions
  ? { readonly [K in keyof C]: NoesisStoreHandle<C[K]> }
  : Record<never, never>;

/** The handle a child definition yields, with its own inferred children. */
export type NoesisStoreHandle<D extends ChildDefinition> = D extends z.ZodType
  ? NoesisStore<z.input<D>, z.output<D>, Record<never, never>>
  : D extends NestedDefinition
    ? NoesisStore<
        z.input<D['schema']>,
        z.output<D['schema']>,
        ChildHandles<D['children']>
      >
    : never;

/** The handle a factory returns for root options. */
export type NoesisStoreOf<
  S extends z.ZodType,
  C extends ChildDefinitions,
> = NoesisStore<z.input<S>, z.output<S>, ChildHandles<C>>;

/**
 * Builds the handle on a root collection. Reads and creates nothing; an
 * invalid definition throws right here, synchronously.
 */
export type CreateNoesisStore = <
  S extends z.ZodType,
  C extends ChildDefinitions = Record<never, never>,
>(
  options: NoesisStoreOptions<S, C>,
) => NoesisStoreOf<S, C>;

// ---------------------------------------------------------------------------
// The handle
// ---------------------------------------------------------------------------

export interface DeleteOptions {
  /** Remove the object together with everything it owns. */
  recursive?: boolean;
}

export interface NoesisStore<Input, Output, Children> {
  /** The collection's directory, absolute. */
  readonly directory: string;

  /** The object's validated data, or `null` when there is no such object. */
  get(key: string): Promise<Output | null>;

  /** Validates, then creates or replaces the object; its children stay. */
  set(key: string, value: Input): Promise<void>;

  /**
   * Removes the object. `false` when there is nothing to remove; `NOT_EMPTY`
   * when it still owns children and `recursive` was not asked for.
   */
  delete(key: string, options?: DeleteOptions): Promise<boolean>;

  /** The keys of the collection's objects, in no particular order. */
  keys(): AsyncIterable<string>;

  /** Handles on the object's child collections; touches no file. */
  children(key: string): Children;
}

// ---------------------------------------------------------------------------
// Errors
// ---------------------------------------------------------------------------

export type NoesisStoreErrorCode =
  | 'INVALID_KEY'
  | 'PARENT_NOT_FOUND'
  | 'INVALID_JSON'
  | 'VALIDATION_FAILED'
  | 'UNSUPPORTED_VALUE'
  | 'NOT_EMPTY'
  | 'IO_ERROR';

export type NoesisStoreOperation =
  | 'get'
  | 'set'
  | 'delete'
  | 'keys'
  | 'children';

export interface NoesisStoreErrorDetails {
  code: NoesisStoreErrorCode;
  operation: NoesisStoreOperation;
  key?: string;
  path?: string;
  cause?: unknown;
}

/** Every failure the store reports, with a stable `code` to branch on. */
export class NoesisStoreError extends Error {
  readonly code: NoesisStoreErrorCode;
  readonly operation: NoesisStoreOperation;
  readonly key?: string;
  readonly path?: string;

  constructor(message: string, details: NoesisStoreErrorDetails) {
    super(message, { cause: details.cause });
    this.name = 'NoesisStoreError';
    this.code = details.code;
    this.operation = details.operation;
    if (details.key !== undefined) this.key = details.key;
    if (details.path !== undefined) this.path = details.path;
  }
}
