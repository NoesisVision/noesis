import type { z } from 'zod';

/**
 * The only door to `.noesis/graph/`. No locks: the atomic
 * rename of `data.json` is the whole guarantee, so the last complete write
 * wins, across processes too. A directory without `data.json` is garbage from
 * an interrupted write or delete: `keys()` skips it, `get` answers `null` and
 * `delete` removes it.
 */

export const DATA_FILE_NAME = 'data.json';
export const KEY_PATTERN = /^[a-z0-9][a-z0-9_-]{0,127}$/;
export const COLLECTION_NAME_PATTERN = /^[A-Za-z][A-Za-z0-9_-]{0,63}$/;

type ChildDefinition = z.ZodType | NestedDefinition;

export interface NestedDefinition {
  schema: z.ZodType;
  children?: ChildDefinitions;
}

export type ChildDefinitions = { readonly [name: string]: ChildDefinition };

export interface NoesisStoreOptions<
  S extends z.ZodType,
  C extends ChildDefinitions,
> {
  directory: string;
  schema: S;
  children?: C;
}

export type ChildHandles<C> = C extends ChildDefinitions
  ? { readonly [K in keyof C]: NoesisStoreHandle<C[K]> }
  : Record<never, never>;

type NoesisStoreHandle<D extends ChildDefinition> = D extends z.ZodType
  ? NoesisStore<z.input<D>, z.output<D>, Record<never, never>>
  : D extends NestedDefinition
    ? NoesisStore<
        z.input<D['schema']>,
        z.output<D['schema']>,
        ChildHandles<D['children']>
      >
    : never;

export type NoesisStoreOf<
  S extends z.ZodType,
  C extends ChildDefinitions,
> = NoesisStore<z.input<S>, z.output<S>, ChildHandles<C>>;

/** Reads and creates nothing; an invalid definition throws synchronously. */
export type CreateNoesisStore = <
  S extends z.ZodType,
  C extends ChildDefinitions = Record<never, never>,
>(
  options: NoesisStoreOptions<S, C>,
) => NoesisStoreOf<S, C>;

export interface DeleteOptions {
  recursive?: boolean;
}

export interface NoesisStore<Input, Output, Children> {
  /** Absolute. */
  readonly directory: string;

  /** Absolute path of the object's `data.json`. Touches no file. */
  dataFile(key: string): string;

  get(key: string): Promise<Output | null>;

  /** Leaves the object's children untouched. */
  set(key: string, value: Input): Promise<void>;

  /**
   * `false` when there is nothing to remove; `NOT_EMPTY` when the object
   * still owns children and `recursive` is not set.
   */
  delete(key: string, options?: DeleteOptions): Promise<boolean>;

  /** In no particular order. */
  keys(): AsyncIterable<string>;

  /**
   * An object that vanishes between listing and reading is skipped; a file
   * that does not decode fails the iteration, as `get` would.
   */
  values(): AsyncIterable<Output>;

  /** Touches no file. */
  children(key: string): Children;
}

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
  | 'values'
  | 'children';

export interface NoesisStoreErrorDetails {
  code: NoesisStoreErrorCode;
  operation: NoesisStoreOperation;
  key?: string;
  path?: string;
  cause?: unknown;
}

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
