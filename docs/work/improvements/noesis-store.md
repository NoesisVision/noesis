---
type: improvement
scope: server/backend
status: draft
created: 2026-09-13
updated: 2026-09-13
---

# Improvement: `NoesisStore` — one door to `.noesis/graph/` for every repository

Target: TypeScript, Bun, Zod, local disk  
Primary use case: the Hono service writing change objects, design documents, wiki entries and system-model files under `.noesis/graph/`

Revision note: the first draft was reviewed on 2026-09-13 against decisions 68 and 74, `packages/shared-contracts/src/conventions.md` and the five repositories built on `FileRepository`. The decisions taken in that review, and in the follow-up on the open points, are folded in below; §13 records what each resolved.

## 1. Purpose

Provide a small, typed API for persisting schema-defined objects in individual JSON files. Support containment through child collections: a change owns its information sources (conversations, documents) and its design documents, each persisted independently.

Reading a parent must not load its children. Listing a collection must not parse object files. Mutable data lives in an external writable directory, including when the application is bundled into a single executable.

The store is the write path of the knowledge graph. Services read from the in-memory graph database; the repositories built on the store exist to modify data files, and the only reader of the files is the indexer that rebuilds the graph at boot and on watcher events. The store therefore offers no collection-wide reads beyond key iteration.

The initial implementation targets one Bun process owning a local data directory. It is a file store, with atomic replacement of individual data files, rather than a transactional database.

## 2. Core model

- A **collection** has a directory, one Zod schema, and optional named child collection definitions.
- An **object** has a key and one `data.json` file containing its schema-defined data.
- A **child collection** belongs to a particular parent object.
- A **key** identifies an object within its collection. It is not automatically added to the stored data.
- A **store handle** provides operations on a collection. Creating a handle does not read or create files.

Containment represents exclusive ownership. The directory hierarchy is the source of truth for membership. Do not maintain a second list of child IDs in the parent or inject a parent ID into child data.

The key is chosen by the repository that owns the collection, not by the store. A change is keyed by its slug, a design document by its `id`, a conversation by its `conversation_id`. The repository is responsible for passing the same value the contract carries; the store neither reads the key out of the data nor checks that they agree.

## 3. Example usage

```ts
import { z } from 'zod';
import { createNoesisStore } from './noesis-store';

const ChangeSchema = z.strictObject({
  slug: z.string(),
  name: z.string(),
  status: z.enum(['discovery', 'active', 'done']),
});

const DesignDocSchema = z.strictObject({
  id: z.string(),
  name: z.string(),
  content: z.string(),
});

const changes = createNoesisStore({
  directory: noesis.resolve('graph', 'changes'),
  schema: ChangeSchema,
  children: {
    conversations: ConversationSchema,
    documents: DocumentSchema,
    'design-docs': DesignDocSchema,
  },
});

await changes.set('improve-authentication', {
  slug: 'improve-authentication',
  name: 'Improve authentication',
  status: 'discovery',
});

const { 'design-docs': designDocs } = changes.children(
  'improve-authentication',
);

await designDocs.set('01a09728-d2ae-7000-bddb-eb240d0bcd88', {
  id: '01a09728-d2ae-7000-bddb-eb240d0bcd88',
  name: 'Authentication design',
  content: '# Authentication\n\n...',
});

// The indexer's read path: keys, then one get per key.
for await (const key of designDocs.keys()) {
  const doc = await designDocs.get(key);
}

await designDocs.delete('01a09728-d2ae-7000-bddb-eb240d0bcd88');

// Explicitly delete the parent and all remaining descendants.
await changes.delete('improve-authentication', { recursive: true });
```

## 4. Public API

The public surface consists of `createNoesisStore`, `get`, `set`, `delete`, `keys`, and `children`.

The following interface describes the returned handle. The factory must infer its input, output, and child handle types from the supplied definitions; callers must not need to supply those type arguments.

```ts
export interface NoesisStore<Input, Output, Children> {
  get(key: string): Promise<Output | null>;

  set(key: string, value: Input): Promise<void>;

  delete(key: string, options?: { recursive?: boolean }): Promise<boolean>;

  keys(): AsyncIterable<string>;

  children(key: string): Children;
}
```

### Factory options

| Option      | Required | Meaning                                                                                        |
| ----------- | -------- | ---------------------------------------------------------------------------------------------- |
| `directory` | Yes      | Root collection directory. Resolve to an absolute path once when constructing the root handle. |
| `schema`    | Yes      | Zod schema for the collection's object data.                                                   |
| `children`  | No       | Map of child collection names to schemas or nested collection definitions.                     |

A schema alone is shorthand for a leaf collection. A nested definition supports deeper containment with the same API:

```ts
children: {
  'design-docs': {
    schema: DesignDocSchema,
    children: {
      attachments: AttachmentSchema,
    },
  },
}
```

Child directories are always derived from their parent path. Child definitions do not accept a `directory` override.

### Type inference

- `set` accepts `z.input<typeof schema>` and validates at runtime.
- `get` returns `z.output<typeof schema> | null`.
- `children(key)` exposes only declared child collection names.
- Each child handle uses its own schema and recursively inferred children.
- Leaf collections return an empty child handle object.

### Method semantics

| Method                             | Contract                                                                                         |
| ---------------------------------- | ------------------------------------------------------------------------------------------------ |
| `get(key)`                         | Read and validate only the object's data file. Return `null` if the object is absent.            |
| `set(key, value)`                  | Validate, then create or replace the object's data file. Preserve all child collections.         |
| `delete(key)`                      | Return `false` if absent. Delete an existing object only if it has no children; otherwise throw. |
| `delete(key, { recursive: true })` | Remove the object and its entire owned subtree. Return `true` when deletion completes.           |
| `keys()`                           | Iterate immediate object keys without parsing their data. Ordering is unspecified.               |
| `children(key)`                    | Return typed handles scoped to this object, without filesystem access.                           |

All I/O through a child handle requires its ancestor objects to exist. If an ancestor is missing, throw `PARENT_NOT_FOUND`. If ancestors exist but the requested child does not, `get` returns `null` and `delete` returns `false`.

A missing root directory behaves as an empty collection for reads, listing, and deletion. The first successful write creates required directories. A write through a child handle must never implicitly create a missing parent object.

## 5. Disk layout

### `.noesis/` as a whole

`.noesis/` already holds more than graph content — the service's scratch space and its log file — so the graph gets its own subdirectory:

```text
.noesis/
  .gitignore        # written by the service: tmp/ and logs/
  graph/            # knowledge graph files; store-managed only
  sources/          # source files an import skill reads: transcripts, .md, .pdf; ignored
  tmp/<session>/    # scratch space, ignored
  logs/             # the service's log file, ignored
```

Only files the store writes may exist under `graph/`. There is no place for notes, hand-made side files or foreign JSON beside the data; anything the store did not write is a violation, not content to ignore. This replaces the rule in `conventions.md` that "anything else beside it is ignored, so notes can sit next to the data".

Two things are called "source" and they land in different places:

- **Information sources** are graph content. A conversation is what the import-conversation skill builds from a transcript; a document is what the import-document skill builds from a Markdown or PDF file. Both are JSON entities with contracts (`Conversation`, `Document`), written through the store as children of a change, indexed into the `Conversation` and `Document` node tables, searchable, and the target of fragment refs from topics and decisions.
- **Source files** are what the skills read: the transcript, the `.md`, the `.pdf`. They are not graph content and are never written through the store. `sources/` is a place to put them so the skill can find them; the service does not index it, does not manage it and does not define its layout. It is not versioned: transcripts and PDFs are large, often private, and the graph built from them is what gets committed. `NoesisDir.ensure()` creates it and keeps it in the `.gitignore` it maintains, beside `tmp/` and `logs/` (decision 76).

### Under `graph/`

Use one directory per object at every depth, named by the key, holding exactly one `data.json` plus child collection directories:

```text
.noesis/graph/
  changes/
    improve-authentication/
      data.json
      conversations/
        <content-hash id>/
          data.json
      documents/
        <content-hash id>/
          data.json
      design-docs/
        01a09728-d2ae-7000-bddb-eb240d0bcd88/
          data.json
  system-model/
    <id>/
      data.json
  wiki/
    topics/
      <id>/
        data.json
    decisions/
      <id>/
        data.json
```

`changes`, `system-model`, `wiki/topics` and `wiki/decisions` are each a root store instance. `wiki/` is a grouping directory, not an object.

The file contains the validated object directly, without a metadata envelope:

```json
{
  "slug": "improve-authentication",
  "name": "Improve authentication",
  "status": "discovery"
}
```

Use UTF-8 JSON with two-space indentation and a trailing newline. No index file is required.

An object exists when its directory contains a regular `data.json` file. A directory under a collection that lacks `data.json` is not an object: `keys()` does not list it, `get` returns `null` for it, and it is to be removed. Such a directory arises from an interrupted write, an interrupted recursive deletion, or a child written while its parent was being deleted (§8); in every case the whole directory, descendants included, is garbage. The service removes such directories in a sweep at boot, over every root store and recursively, before the indexer runs, logging each removal. Between sweeps `keys()` keeps ignoring them.

`keys()` examines immediate object directories and the presence of their data files. It may inspect filesystem metadata, but must not open and parse each JSON document. A corrupted object remains discoverable by key; reading it reports the corruption.

Iteration is not a snapshot. Concurrent additions or removals may or may not appear. Do not promise sorting or collection-wide consistency, and do not hold a lock while waiting for the caller to consume the next item.

### What this replaces

The layout from decision 68 (flat `<slug>-<id-suffix>.json` files per kind directory) and decision 74 (`change.json` inside the change directory) go. The human-readable slug in the file name goes with them: a directory named by an opaque id is what a `git diff` shows. The `slug` remains a field inside `data.json` for changes, where it is also the key.

## 6. Keys and collection names

Object keys must match:

```text
^[a-z0-9][a-z0-9_-]{0,127}$
```

This allows change slugs (`improve-authentication`, at most 64 characters by the `change` contract), UUID strings and hash-derived ids. Reject invalid keys before filesystem access. Do not normalize or silently modify keys.

Child collection names are application-defined and must match:

```text
^[A-Za-z][A-Za-z0-9_-]{0,63}$
```

Names are preserved exactly, including `design-docs`. Reject sibling collection names that differ only by case, so definitions remain portable across case-sensitive and case-insensitive filesystems.

Neither keys nor collection names may contain path separators or traversal segments. Managed object paths must not follow symbolic links. The data directory is application-controlled; concurrent modification by unrelated filesystem processes is outside the concurrency contract, but git operations underneath the service are normal (decision 68) and must never make the store throw anything other than the errors in §9 or leave it wedged.

## 7. Validation and JSON representation

On `set`:

1. Validate the supplied value with the collection schema using `parseAsync`.
2. Confirm the parsed value is representable by the supported JSON format.
3. Serialize the parsed value, not the original input.
4. Persist it using the replacement procedure below.

On `get`:

1. Read the requested file.
2. Parse JSON.
3. Validate with the collection schema using `parseAsync`.
4. Return the parsed value without writing it back automatically.

Version one supports object schemas composed of JSON-compatible values: plain objects, arrays, strings, finite numbers, booleans, and null. Optional object properties may be omitted. Reject non-JSON values such as `Date`, `BigInt`, maps, sets, functions, cycles, and undefined array elements rather than silently changing or dropping them.

Schemas must be stable across a JSON round trip: validating persisted output again must preserve its meaning. Defaults and idempotent normalization can be used. Arbitrary transformations that change representation, such as string to `Date`, require a future explicit codec layer and are outside this version.

Unknown-property behavior follows the supplied schema. Use `z.strictObject` when unexpected properties should cause an error.

TypeScript types do not replace runtime validation. Schema changes that make existing files invalid produce validation errors; migrations are application-managed in this version.

## 8. Writes, concurrency, and deletion

### Individual file replacement

Write to a uniquely named temporary file inside the target object's directory. Close the completed file, then rename it over `data.json`. Never truncate the current data file before the replacement is ready.

A validation or serialization failure must leave the existing data untouched. A write failure before the rename must leave the old data file intact. Clean up the operation's temporary file on failure when possible, preserving the original error as the primary failure.

Resolve `set` only after replacement succeeds. Readers see the previous complete file or the replacement complete file, not a partially written document, on supported local filesystems with atomic rename semantics.

This is an atomic-visibility guarantee, not a guarantee of survival after sudden power loss. Full crash durability through file and directory synchronization is outside the initial contract. Interrupted operations can leave temporary files or empty directories; listing ignores them.

### Concurrency: last write wins

Decision 68 (point 9) stands: concurrent writers are resolved by atomic whole-file replacement, and the last complete write wins. The store has no operation coordinator, no per-object queue and no locks.

- Two `set` calls on the same key, from the same process or from two service processes on one checkout, each produce a complete valid file; whichever rename lands last is the file that stays.
- A `get` followed by `set` is not a transaction. Callers needing read-modify-write semantics must serialize the complete operation at the application layer.
- A recursive deletion racing a child write is not prevented. The child write checks that its parent exists before writing, but the parent may disappear between the check and the rename. The outcome is a directory under the collection without `data.json` — by §5 not an object, listed by nobody, and garbage to be removed.
- A read racing a recursive deletion may see `PARENT_NOT_FOUND`, `null` or, for a single object, the complete file. It never sees a partial document.

Multi-process coordination, worker threads and network filesystems are outside this version's contract; the atomic-rename guarantee is what holds across processes on a local filesystem.

### Deletion

Default deletion must fail with `NOT_EMPTY` before removing the parent if any child objects exist. Empty child collection directories do not make an object nonempty.

The nonempty check must account for owned descendant directories even if their collection is no longer declared in the current application configuration. Unknown non-temporary contents must prevent ordinary deletion rather than being silently discarded; under `graph/` such contents are a violation of §5, and refusing is the safe default.

Recursive deletion explicitly removes the entire object directory, including descendants and leftover temporary files. It is not crash-atomic: interruption or an I/O failure may leave a partially removed subtree. Return success only after removal completes; surface failures. Retrying recursive deletion must also clean up an existing residual directory even when its `data.json` has already been removed. Return `false` only when there is no target directory to remove.

Saving multiple objects also consists of separate operations. No multi-file commit or rollback is provided.

## 9. Error contract

Use a store-specific error with a stable code and contextual fields:

```ts
type NoesisStoreErrorCode =
  | 'INVALID_KEY'
  | 'PARENT_NOT_FOUND'
  | 'INVALID_JSON'
  | 'VALIDATION_FAILED'
  | 'UNSUPPORTED_VALUE'
  | 'NOT_EMPTY'
  | 'IO_ERROR';

interface NoesisStoreError extends Error {
  code: NoesisStoreErrorCode;
  operation: 'get' | 'set' | 'delete' | 'keys' | 'children';
  key?: string;
  path?: string;
  cause?: unknown;
}
```

Preserve underlying Zod issues or filesystem errors in `cause`. Invalid factory definitions should fail synchronously with a descriptive configuration error.

Only expected absence maps to `null` or `false`. Permission errors, invalid JSON, and schema failures must not masquerade as missing data. Do not include complete stored objects in error messages.

The Hono integration decides how errors map to HTTP responses and must avoid exposing internal paths to clients.

## 10. Performance and application integration

- Services read from the in-memory graph, never from the store. The repositories built on the store are the write path: create, replace, delete.
- The indexer is the only reader of graph files. At boot and on a watcher event it walks each collection with `keys()` and reads each object with `get`; a corrupt or invalid file is reported per key and does not stop the walk. There is no `getAll`, no automatic population and no collection-wide query in version one, and no sorted listing: ordering is the graph's job.
- Do not preload or cache whole collections.
- Listing uses directory iteration and metadata inspection only.
- Each read or write processes one complete object. Reading, validation, and serialization can allocate multiple representations of that object in memory.
- JSON parsing and serialization are not streaming operations in this design. Async filesystem methods do not make that CPU work nonblocking.
- Callers control parallelism when processing many large objects.
- Backend code owns disk access. React accesses objects through Hono endpoints.
- Resolve the data directory from deployment configuration (`NoesisDir`, decision 68 point 6). Do not import mutable JSON into the application bundle or store it inside the executable.
- The library does not log object contents. Applications may log operation metadata such as key, duration, and result.

### Consequences for existing code

- `FileRepository` and its `StoredFile<T>` (entity, path, hash, mtime) are replaced. The five repositories on it (`ChangesRepository`, `DesignDocsRepository`, `ConversationsRepository`, `DocumentsRepository`, `TopicsRepository`, `DecisionsRepository`, `SystemModelRepository`) become thin wrappers over store handles, each choosing its key.
- `ChangesRepository` loses `list`, `exists` and the "directory without `change.json` is still a change" fallback of decision 74. Existence is answered by the graph.
- `ConversationsRepository` and `DocumentsRepository` stay on the store as children of a change, keyed by `conversation_id` and `document_id`.
- The watcher's ignore rules change: only `graph/` is graph content; `sources/`, `tmp/`, `logs/` and `.gitignore` are not.
- The `updated_at` column is dropped from every node table and `updatedAt` from `DesignDocSummary`: it was the file's mtime, which a `git checkout` rewrites, and nothing in the UI reads it. A "last modified" field returns as data written by a repository when a view needs it.
- `FileRef.hash` is dropped; `FileRef.check()` has no caller. `source_sha` on fragment refs is computed by the import service from the conversation or document it writes, not read back from the store. Since a source's id is already a hash of its content, the import feature decides whether `source_sha` still carries information.
- `conventions.md` is rewritten for the new layout, and a decisions.md entry amends 68 (layout, file names, `updated_at`, `FileRef.hash`) and 74 (`change.json`, the fallback).
- The two test changes on disk (`.noesis/changes/test`, `test-2`) are moved by hand or deleted; no migration code.

## 11. Acceptance criteria

The implementation is complete when these behaviors are verified:

1. Schema input/output and child collection types are inferred without manual generics.
2. Objects survive process restart and occupy independent files under `.noesis/graph/`.
3. Reading a parent does not access child JSON contents.
4. Listing keys does not parse JSON, including when an existing object's JSON is malformed.
5. Invalid input cannot replace an existing valid object.
6. Invalid on-disk JSON and schema mismatches produce distinct errors.
7. Replacing parent data preserves its descendants.
8. Child writes fail when a parent is missing and do not create a parent implicitly.
9. Ordinary deletion rejects nonempty objects; explicit recursive deletion removes their subtrees.
10. Concurrent same-key replacements, from one process or two, each produce a complete valid file and the last rename wins.
11. Invalid keys cannot escape the configured directory; managed symlinks are rejected.
12. Temporary files and directories without `data.json` are ignored during key listing.
13. Retrying an interrupted recursive deletion can remove the residual subtree, and the boot sweep removes any directory without `data.json` that a crash left behind.
14. The indexer rebuilds the graph from `graph/` through `keys()` and `get` alone, and a corrupt file costs one key, not the boot.
15. A bundled Bun executable can read and update an external data directory without requiring source files or bundled mutable JSON.

## 12. Out of scope

- Shared ownership, cross-parent references, and relationship indexes.
- Moving or reparenting objects as an atomic operation.
- Multi-process coordination and network filesystem guarantees.
- Multi-object transactions, compare-and-swap, and automatic read-modify-write operations.
- Partial JSON updates, full-text search, and secondary indexes.
- Automatic migrations, backups, encryption, or recovery of corrupt documents.
- Runtime codecs for non-JSON types.
- The contents and layout of `sources/`; the service never reads it.

If a conversation must belong to multiple changes, store it in a separate top-level collection and model references explicitly. Do not represent shared objects through this ownership hierarchy.

## 13. Resolved points

Decided on 2026-09-13 after the review:

1. **Layout:** `<key>/data.json` at every depth, under `.noesis/graph/`, store-managed files only (§5).
2. **Key:** chosen by each repository — slug for changes, the contract id elsewhere (§2).
3. **Concurrency:** last write wins over atomic replacement, no coordinator and no locks (§8).
4. **Directory without `data.json`:** not an object; removed by a sweep at boot (§5).
5. **Reads:** services read the graph; the store's readers are the indexer and the sweep; no `getAll`, no sorted listing (§10).
6. **`updated_at`:** dropped, no consumer (§10).
7. **`FileRef.hash`:** dropped; `source_sha` is the import service's concern (§10).
8. **`has(key)`:** not added; existence is answered by the graph. Added only if a repository needs it without a parse.
9. **Name:** `NoesisStore`, `createNoesisStore`, `NoesisStoreError`.
10. **`sources/`:** the drop zone for source files a skill reads, outside the store and the index; information sources are graph content under the change (§5).

11. **`sources/` is ignored** by git, like `tmp/` and `logs/`.

Recorded as decision 76 in `docs/decisions.md`.

## References

- [Zod: parsing, async validation, and inferred input/output types](https://zod.dev/basics)
- [Zod: schema API](https://zod.dev/api)
- [Bun: file I/O](https://bun.com/docs/runtime/file-io)
- Decision 68 (files as the source of truth, layout, last write wins), decision 74 (`change.json`), `packages/shared-contracts/src/conventions.md`.

The API and behavioral guarantees above are the proposed store contract, not functionality already provided by Zod or Bun alone.
