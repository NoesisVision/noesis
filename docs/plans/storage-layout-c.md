# Plan: flat per-change storage

Replace the generic nested `NoesisStore` with a small `JsonCollection` over one
JSON file per entity, one folder per change, and read graph files and session
working files through one codec.

This plan assumes `dated-entity-ids.md` is implemented: changes, documents and
design docs already carry dated slug ids (`ChangeId`, `DocumentId`,
`DesignDocId`), every write is an upsert through `save_change`,
`save_document` and `save_design_doc`, and the plugin mints ids with
`entity-id.ts`. Nothing here changes an id, a model field or a tool contract.

## Use cases

1. Get an entity (change, design doc, document) by id:
   `changes.get(id)`, `designDocs.get(change, id)`, `documents.get(change, id)`.
2. List all design docs within a single change: `designDocs.list(change)`.
3. List all documents within a single change: `documents.list(change)`.
4. List a summary of all entities (design docs and documents) within a single
   change: `changes.entries(change)`, one `readdir` of the change folder.

Documents and design docs are loaded from two places, with one shared codec:

- the graph folder, where the server put them, so their structure is correct;
- the session dir, where the agent generates them, so they may have structure
  errors; after validation they are identical to the graph files.

Constraints: collections are returned as promises of arrays, never
`AsyncIterable` (the whole result is needed in memory); simplicity over
performance, as there are few, small files.

## Decisions

| Topic          | Decision                                                                                                                        |
| -------------- | ------------------------------------------------------------------------------------------------------------------------------- |
| Layout         | C: one folder per change, entity kind in the file name                                                                          |
| Store API      | `JsonCollection<T>` underneath, thin repositories on top; collections return `Promise<T[]>`, never `AsyncIterable`              |
| Sharing        | R1: one codec (`readJsonFile` / `writeJsonFile`) for the graph and the session dir                                              |
| Session dir    | Free form: the agent writes a working file anywhere under `.noesis/sessions/` (renamed from `.noesis/tmp/`) and passes its path |
| File names     | The entity's id; a mismatch between the file name and `body.id` is a validation failure                                         |
| Default order  | Collections list by id, so by creation date, then title                                                                         |
| Bad graph file | `list()` and `get()` throw (no skipping)                                                                                        |
| Scope          | Changes, documents, design docs **and** the system model move; `NoesisStore` is deleted                                         |
| Migration      | None: the nested `graph/changes/<changeId>/` folders (`data.json`, `documents/`, `design-docs/`) are dev data, deleted by hand  |

## Layout

```
.noesis/
  graph/
    changes/
      <changeId>/                               # 2026-09-24-payment-retry/
        change.json
        <designDocId>.design-doc.json           # 2026-09-24-refund-flow.design-doc.json
        <documentId>.document.json              # 2026-09-25-meeting-notes.document.json
    system-models/
      <systemModelId>.system-model.json
  sessions/
    <sessionId>/
      anything.json            # free form; the tool says which kind it is
```

- The file name repeats the id in the body (for `change.json`, the folder name
  does). On read, a mismatch between the file name and `body.id` is a
  validation failure (a hand-renamed file must not silently answer to two
  ids).
- Use case 4 (summary of a change) is one `readdir` of `changes/<changeId>/`:
  the suffix says the kind, and each file is read for its name.
- `system-models/` replaces `system-model/`; the scanner writes the whole
  directory again on the next scan, so nothing needs moving. The system model
  keeps its content-hash id; `SystemModelSchema.id` stays a plain string,
  validated as a file-name-safe id by the collection.

## Models

New, for use case 4:

```ts
// app/changes/change-entry.ts
export const ChangeEntrySchema = z.discriminatedUnion('kind', [
  z.object({
    kind: z.literal('design-doc'),
    id: DesignDocId,
    name: z.string(),
    path: z.string(),
  }),
  z.object({
    kind: z.literal('document'),
    id: DocumentId,
    name: z.string(),
    path: z.string(),
  }),
]);
```

`ChangeNavigationItem` (the sidebar) is rebuilt on top of it.

## Codec (R1)

`platform/files/json-file.ts`. Errors are plain strings: the only consumer of
a failure is a message to the agent or an exception text, so there is no
structured issue list. `app/validation/validator.ts` and its spec are deleted;
Zod 4's `z.prettifyError` does the formatting (issue message plus path, e.g.
`✖ Invalid change id: expected e.g. '2026-09-24-payment-retry' → at id`).

```ts
/** Unreadable file, broken JSON or schema failure, as one message. */
export async function readJsonFile<T>(
  path: string,
  schema: ZodType<T>,
): Promise<Result<T, string>> {
  let json: unknown;
  try {
    json = JSON.parse(await Bun.file(path).text());
  } catch (error) {
    return err(`Unreadable JSON: ${String(error)}`);
  }
  const parsed = schema.safeParse(json);
  return parsed.success ? ok(parsed.data) : err(describeIssues(parsed.error));
}

/** One mistake repeated across a large array must not bury the first real cause. */
const ISSUE_CAP = 20;

function describeIssues(error: z.ZodError): string {
  const shown = new z.ZodError(error.issues.slice(0, ISSUE_CAP));
  const more = error.issues.length - ISSUE_CAP;
  return z.prettifyError(shown) + (more > 0 ? `\n… and ${more} more` : '');
}

/** Validates, encodes, writes `path.<random>.tmp`, renames over `path`. Creates the parent dir. */
export function writeJsonFile<T>(
  path: string,
  schema: ZodType<T>,
  value: T,
): Promise<void>;

export class JsonFileError extends Error {
  readonly path: string;
  // message: the string readJsonFile returned, prefixed with the path
}
```

- `readJsonFile` knows nothing about file names or ids: session file names are
  free form, so the id-versus-name check belongs to `JsonCollection`.
- `readJsonFile` never answers `null`: a missing file is an `err` like any
  other unreadable file. A caller that treats "absent" differently checks
  existence first, as `JsonCollection.get` does.
- The strict unwrap (`throw new JsonFileError(path, message)`) lives in the
  collection, so graph reads throw and session reads report.
- Kept from today's store: atomic temp-plus-rename (a reader such as the
  watcher-triggered indexer never sees a half-written file), pretty JSON with a
  trailing newline, `schema.encode` before writing. Dropped: symlink guards,
  ancestor checks, the unrepresentable-value walk (the schema already rejects
  those values), the seven error codes.

## JsonCollection

`platform/files/json-collection.ts`, about 60 lines:

```ts
export interface Placement {
  pathOf(id: string): string;
  /** Ids present on disk, unordered. */
  ids(): Promise<string[]>;
}

/** `<dir>/<id>.<kind>.json` */
export function flatFiles(dir: string, kind: string): Placement;
/** `<dir>/<id>/<fileName>` */
export function folderFiles(dir: string, fileName: string): Placement;

export class JsonCollection<T extends { id: string }> {
  constructor(schema: ZodType<T>, placement: Placement);
  get(id: string): Promise<T | null>; // null when absent, JsonFileError when broken
  list(): Promise<T[]>; // sorted by id; throws on the first broken file
  save(entity: T): Promise<void>; // path from entity.id
  delete(id: string): Promise<boolean>;
  pathOf(id: string): string;
}
```

- `ids()` filters directory entries by the suffix (flat) or by the presence of
  `fileName` (folder); a directory that does not exist yields `[]`.
- Temp files (`*.tmp`) never match the suffix, so they are never listed.
- `list()` sorts by id, so every list is in creation-date order by default.
- Reading a file also checks `body.id === id` from the name; a mismatch is a
  `JsonFileError` (a hand-renamed file must not answer to two ids). This is
  the only graph-side check the session side does not share.

## Repositories

Interfaces in `app/`, one implementation each in `adapters/store/`:

```ts
interface ChangesRepository {
  get(id: ChangeId): Promise<Change | null>;
  list(): Promise<Change[]>;
  save(change: Change): Promise<void>; // children stay
  entries(id: ChangeId): Promise<ChangeEntry[]>; // use case 4
}

interface DesignDocsRepository {
  get(change: ChangeId, id: DesignDocId): Promise<DesignDocument | null>;
  list(change: ChangeId): Promise<DesignDocument[]>;
  save(change: ChangeId, doc: DesignDocument): Promise<void>;
  pathOf(change: ChangeId, id: DesignDocId): string;
}

// DocumentsRepository: same shape as DesignDocsRepository.
```

- Implementation: `new JsonCollection(schema, flatFiles(join(changesDir, changeId), 'design-doc'))`,
  built per call (it holds no state).
- `entries` reads the change folder once and delegates to both collections'
  file reads; or composes `designDocs.list` + `documents.list` (pick the
  simpler during implementation).
- `delete` is dropped from the document and design-doc repositories: nothing
  calls it (no MCP tool, no HTTP route). The collection keeps it for the
  scanner. Knip will confirm.
- The `AsyncIterable` methods (`keys()`, `values()`) and `children()` go;
  services move from `read` / `write` / `set` to `get` / `save`. The sorting
  the services added in the ids plan moves into `list()`.
- `SystemModelStore` becomes `new JsonCollection(SystemModelSchema, flatFiles(noesis.resolve('graph', 'system-models'), 'system-model'))`.

## Services

- `ChangesService`: new `entries(id)` (use case 4); `listNavigation()` becomes
  `list()` plus `entries()` per change. The rest keeps its behaviour on the
  new repository methods.
- `DocumentsService` / `DesignDocsService`: unchanged apart from the
  repository method names.

## MCP tools

Contracts are unchanged; only how a working file is loaded changes. Each step
answers in-band:

1. The MCP SDK checks the tool input shape (`change`, `path` strings).
2. `withChange` parses `ChangeId` (not for `save_change`).
3. `session.resolveWorkingPath(path)` resolves relative paths against the
   repository root, follows symlinks and requires the result under
   `.noesis/sessions/`. It returns a `WorkingFilePath`.
4. The size limit (4 MB).
5. `readJsonFile(path, schema)`: JSON, then the schema.
6. The service call (`save`), whose domain errors the tool maps to failures.
7. The collection writes through `writeJsonFile`, which validates again.

- `readWorkingFile` returns `ResultAsync<T, string>`; the tool answers
  ``failure(`Invalid ${SUBJECT}:\n${message}`)``. `wholeFileIssue` and
  `formatReport` go with `validator.ts`.
- `WorkingFilePath` (in `session-dir.ts`) is a brand, not a Zod schema:
  whether a path is safe depends on the filesystem, so no `parse` can decide
  it. Only `resolveWorkingPath` produces one, and `readWorkingFile` takes only
  that type past step 3, so reading an unchecked agent path is a compile
  error. It is still a `string`, so it passes to `readJsonFile` as is. Graph
  paths stay plain strings: they are built from dated-id value objects and
  are safe by construction.

  ```ts
  declare const workingFilePathBrand: unique symbol;
  /** Checked by `resolveWorkingPath`: real, and under `.noesis/sessions/`. */
  export type WorkingFilePath = string & {
    readonly [workingFilePathBrand]: true;
  };
  ```

## Plugin

- Nothing in the plugin knows the graph layout (`entity-id.ts` never reads
  `.noesis/`), so only texts change: the README and the `save-document` skill
  name `.noesis/sessions/<session>/`.

## Indexer and scanner

- `IndexService.collect`: `await changes.list()`, then per change
  `designDocs.list(id)` and `documents.list(id)`; `systemModels.list()`. The
  `objects()` skip helper and the `NoesisStoreError` checks go. A broken file
  now fails the rebuild: the watcher logs it and the previous graph stays, as
  after any failed rebuild.
- `ScannerService`: `set(model.id, model)` becomes `save(model)`, `dataFile`
  becomes `pathOf`, `values()` becomes `list()`.

## Sessions directory

`.noesis/tmp/` becomes `.noesis/sessions/`. The atomic-write temp files
(`*.tmp`) keep their suffix; they are unrelated to this directory.

- `platform/files/session-dir.ts`: `TMP_DIR_NAME = 'tmp'` becomes
  `SESSIONS_DIR_NAME = 'sessions'`; `tmpRoot` becomes `sessionsRoot`; the
  refusal message and doc comments say `.noesis/sessions/`.
- `platform/files/noesis-dir.ts`: `UNVERSIONED_DIRS = ['sessions', 'logs']`,
  so the service creates it and adds `sessions/` to `.noesis/.gitignore`. An
  existing `tmp/` line stays in old checkouts: the service only appends, and
  the line is harmless.
- `platform/files/watcher.ts`: `isIgnored` ignores `sessions` and
  `sessions/…` instead of `tmp`.
- MCP server instructions, `readWorkingFile` and `change-scoped.ts` tool
  descriptions name `.noesis/sessions/`.
- Specs: `session-dir.spec.ts`, `noesis-dir.spec.ts`, `watcher.spec.ts`,
  `mcp-server.spec.ts`, `mcp.e2e.spec.ts`.
- A leftover `.noesis/tmp/` is not swept by the service (it only sweeps its
  own root); delete it by hand.

## HTTP and frontend

- New: `GET /ui/changes/:change/entries` for use case 4 (the overview can use
  it instead of two lists).
- The sidebar reads the rebuilt `ChangeNavigationItem`.

## Deletions

- `platform/files/noesis-store.ts`, `platform/files/bun-noesis-store.ts`
- `test/.../noesis-store.spec.ts`, `noesis-store.writer.ts`
- `app/validation/validator.ts` and `validator.spec.ts`
- The `.noesis/tmp/` session leftovers (by hand)
- The `.noesis/changes/` leftover of an older layout, and the nested
  `.noesis/graph/changes/<changeId>/` dev data (by hand)

## Steps

Each step leaves the root CI scripts green.

1. Rename `.noesis/tmp/` to `.noesis/sessions/` (session dir, noesis dir,
   watcher, MCP texts, plugin texts, specs) and make `resolveWorkingPath`
   return a `WorkingFilePath`. Independent of the rest, so it goes first.
2. Add `json-file.ts` and `json-collection.ts` with specs (temp dir: flat and
   folder placements, id/name mismatch, broken JSON, schema failure, issue
   cap, atomic write, missing dir).
3. Switch the repositories, services and indexer to `JsonCollection` and
   layout C in one step; move the system-model store and the scanner.
4. Switch `readWorkingFile` to `readJsonFile`; delete `validator.ts` and its
   spec.
5. `ChangeEntry`, `entries` in the repository, service and HTTP route;
   rebuild `ChangeNavigationItem` on it.
6. Delete `NoesisStore` and dead tests; run knip.
7. Update `docs/arch/ARCHITECTURE.md` where it describes the store, the
   layout and `.noesis/tmp/`.
