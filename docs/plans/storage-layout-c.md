# Plan: flat per-change storage

Replace the generic nested `NoesisStore` with a small `JsonCollection` over one
JSON file per entity, a change's documents and design docs in a folder named
after the change, and read graph files and session working files through one
codec.

This plan assumes `dated-entity-ids.md` is implemented: changes, documents and
design docs already carry dated slug ids (`ChangeId`, `DocumentId`,
`DesignDocId`), every write is an upsert through `save_change`,
`save_document` and `save_design_doc`, and the plugin mints ids with
`entity-id.ts`. Nothing here changes an id, a model field, a tool contract or
a UI payload.

## Use cases

1. Get an entity (change, design doc, document) by id:
   `changes.get(id)`, `designDocs.get(change, id)`, `documents.get(change, id)`.
2. List all design docs within a single change: `designDocs.list(change)`.
3. List all documents within a single change: `documents.list(change)`.
4. List a summary of all entities (design docs and documents) within a single
   change: `ChangesService.entries(change)`, composed from use cases 2 and 3.

Documents and design docs are loaded from two places, with one shared codec:

- the graph folder, where the server put them, so their structure is correct;
- the session dir, where the agent generates them, so they may have structure
  errors; after validation they are identical to the graph files.

Constraints: collections are returned as promises of arrays, never
`AsyncIterable` (the whole result is needed in memory); simplicity over
performance, as there are few, small files.

## Decisions

| Topic          | Decision                                                                                                                                                                                                               |
| -------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Layout         | C: `changes/<id>.change.json` beside `changes/<id>/`, which holds the change's documents and design docs; the entity kind is in the file name                                                                          |
| Store API      | `JsonCollection<T>` underneath, thin repositories on top; collections return `Promise<T[]>`, never `AsyncIterable`                                                                                                     |
| Sharing        | R1: one codec (`readJsonFile` / `writeJsonFile`) for the graph and the session dir                                                                                                                                     |
| Session dir    | Free form: the agent writes a working file anywhere under `.noesis/sessions/` (renamed from `.noesis/tmp/`) and passes its path                                                                                        |
| File names     | The entity's id; a mismatch between the file name and `body.id` is a validation failure                                                                                                                                |
| Default order  | `JsonCollection.list()` sorts by id ascending; `ChangesService.list()` reverses it (newest first), documents and design docs stay ascending, as the ids plan says                                                      |
| Bad graph file | `list()` and `get()` throw (no skipping); a file that vanishes between `readdir` and its read is skipped. One broken file fails the whole rebuild: the UI keeps the last good graph and the watcher log names the file |
| Ids on disk    | `/^[a-z0-9][a-z0-9-]*$/`, checked by the collection in `save` and `pathOf`: the dated ids and the system model's content hash both fit, and no id can name a path                                                      |
| UI contract    | Unchanged: `ChangeNavigationItem` keeps its shape and no HTTP route is added                                                                                                                                           |
| Scope          | Changes, documents, design docs **and** the system model move; `NoesisStore` is deleted                                                                                                                                |
| Migration      | None: the nested `graph/changes/<changeId>/` folders (`data.json`, `documents/`, `design-docs/`) are dev data, deleted by hand                                                                                         |

## Layout

```
.noesis/
  graph/
    changes/
      <changeId>.change.json                    # 2026-09-24-payment-retry.change.json
      <changeId>/                               # 2026-09-24-payment-retry/
        <designDocId>.design-doc.json           # 2026-09-24-refund-flow.design-doc.json
        <documentId>.document.json              # 2026-09-25-meeting-notes.document.json
    system-models/
      <systemModelId>.system-model.json
  sessions/
    <sessionId>/
      anything.json            # free form; the tool says which kind it is
```

- Every entity is `<dir>/<id>.<kind>.json`, the change included: one shape,
  one collection class, no special case for a folder-held file. The change's
  own file sits beside its folder, not inside it, so a change with no
  documents yet has no folder at all.
- The file name repeats the id in the body. On read, a mismatch between the
  file name and `body.id` is a validation failure (a hand-renamed file must
  not silently answer to two ids).
- Use case 4 reads the change's design docs and documents (use cases 2 and
  3): the summary needs each file's name, so a `readdir` alone answers
  nothing.
- A change's folder appears with its first child; `writeJsonFile` creates it.
  A folder with no `.change.json` beside it is an orphan (a `git checkout`
  that removed the change): the change list never sees it, and
  `assertExists(changeId)` in the services stops new children landing in it.
- `system-models/` replaces `system-model/`; the scanner writes the whole
  directory again on the next scan, so nothing needs moving. The system model
  keeps its content-hash id (`contentHashAsUuid`: hex and dashes), which fits
  the collection's id pattern; `SystemModelSchema.id` stays a plain string.

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

`ChangesService.entries` answers it. `ChangeNavigationItem` (the sidebar)
keeps its shape and is built from the same two lists, so the UI payload does
not change.

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
/** What may name a file: dated ids and content hashes fit, a path never does. */
export const ID_PATTERN = /^[a-z0-9][a-z0-9-]*$/;

/** `<dir>/<id>.<kind>.json` */
export class JsonCollection<T extends { id: string }> {
  constructor(schema: ZodType<T>, dir: string, kind: string);
  get(id: string): Promise<T | null>; // null when absent, JsonFileError when broken
  list(): Promise<T[]>; // by id ascending; skips a file gone since readdir; throws on the first broken file
  save(entity: T): Promise<void>; // path from entity.id
  delete(id: string): Promise<boolean>;
  pathOf(id: string): string;
}
```

- `list()` reads the directory and keeps the names ending in `.<kind>.json`;
  a directory that does not exist yields `[]`. A name that vanishes between
  `readdir` and its read (a `git checkout` under the walk) makes `get` answer
  `null`, and `list()` leaves it out: absent is not broken.
- Temp files (`*.tmp`) never match the suffix, so they are never listed.
- `list()` sorts by id ascending; a caller that wants newest first reverses.
- An id that fails `ID_PATTERN` is an `Error` from `save`, `get`, `delete`
  and `pathOf`, before any path is built.
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
}

interface DesignDocsRepository {
  get(change: ChangeId, id: DesignDocId): Promise<DesignDocument | null>;
  list(change: ChangeId): Promise<DesignDocument[]>;
  save(change: ChangeId, doc: DesignDocument): Promise<void>;
  pathOf(change: ChangeId, id: DesignDocId): string;
}

// DocumentsRepository: same shape as DesignDocsRepository.
```

- Implementation: `new JsonCollection(ChangeSchema, changesDir, 'change')`
  for changes; `new JsonCollection(schema, join(changesDir, changeId), 'design-doc')`
  and `'document'` for the children, built per call (it holds no state).
- `entries` is not a repository method: it is the two child lists, so it
  lives in `ChangesService` (see Services).
- `delete` is dropped from the document and design-doc repositories: nothing
  calls it (no MCP tool, no HTTP route). The collection keeps it for the
  scanner. Knip will confirm.
- The `AsyncIterable` methods (`keys()`, `values()`) and `children()` go;
  services move from `read` / `write` / `set` to `get` / `save`. The child
  services drop their sort (`list()` is ascending already); `ChangesService`
  keeps its reverse.
- `SystemModelStore` becomes `new JsonCollection(SystemModelSchema, noesis.resolve('graph', 'system-models'), 'system-model')`.

## Services

- `ChangesService`: new `entries(id)` (use case 4): `assertExists(id)`, then
  `designDocs.list(id)` and `documents.list(id)` mapped to `ChangeEntry`,
  design docs first, each kind by id. `listNavigation()` builds
  `ChangeNavigationItem` from the same two lists, shape unchanged. `list()`
  reverses the collection's order (newest first). The rest keeps its
  behaviour on the new repository methods.
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
  now fails the rebuild: `IndexService` logs the `JsonFileError` path and
  message at error level and rethrows, the previous graph stays, as after any
  failed rebuild, and the UI shows it until the file is fixed. Chosen over
  skipping: a half-indexed graph would hide the entity without a trace.
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

Nothing changes: `ChangeNavigationItem` keeps its shape and no route is added.
A route for `entries` waits for a view that needs it.

## Deletions

- `platform/files/noesis-store.ts`, `platform/files/bun-noesis-store.ts`
- `test/.../noesis-store.spec.ts`, `noesis-store.writer.ts`
- `app/validation/validator.ts` and `validator.spec.ts`
- The `.noesis/tmp/` session leftovers (by hand)
- The `.noesis/changes/` leftover of an older layout, and the nested
  `.noesis/graph/changes/<changeId>/data.json` dev data (by hand)

## Steps

Each step leaves the root CI scripts green.

1. Rename `.noesis/tmp/` to `.noesis/sessions/` (session dir, noesis dir,
   watcher, MCP texts, plugin texts, specs) and make `resolveWorkingPath`
   return a `WorkingFilePath`. Independent of the rest, so it goes first.
2. Add `json-file.ts` and `json-collection.ts` with specs (temp dir:
   id/name mismatch, `ID_PATTERN` rejection, a file removed between `readdir`
   and read is skipped, broken JSON throws from `list()`, schema failure,
   issue cap, atomic write, missing dir, ascending order).
3. Switch the repositories, services and indexer to `JsonCollection` and
   layout C in one step; move the system-model store and the scanner.
4. Switch `readWorkingFile` to `readJsonFile`; delete `validator.ts` and its
   spec.
5. `ChangeEntry` and `ChangesService.entries` with a spec; `listNavigation`
   keeps its output.
6. Delete `NoesisStore` and dead tests; run knip.
7. Update `docs/arch/ARCHITECTURE.md` where it describes the store, the
   layout and `.noesis/tmp/`.
