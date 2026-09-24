# Plan: flat per-change storage with uuid ids

Replace the generic nested `NoesisStore` with a small `JsonCollection` over one
JSON file per entity, key every entity by a uuidv7, and read graph files and
session working files through one codec.

## Decisions

| Topic           | Decision                                                                                                                                                           |
| --------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Layout          | C: one folder per change, entity kind in the file name                                                                                                             |
| Store API       | `JsonCollection<T>` underneath, thin repositories on top; collections return `Promise<T[]>`, never `AsyncIterable`                                                 |
| Sharing         | R1: one codec (`readJsonFile` / `writeJsonFile`) for the graph and the session dir                                                                                 |
| Session dir     | Free form: the agent writes a working file anywhere under `.noesis/sessions/` (renamed from `.noesis/tmp/`) and passes its path                                    |
| Ids             | uuidv7 only, for changes, documents and design docs; slugs are removed                                                                                             |
| Who mints ids   | The writer of the file: the agent (or its skill script) puts `id` in the body. Every entity, the change included, reaches the server as a session file             |
| Get by id       | Nested: `get(changeId, id)` reads one known path; HTTP routes stay `/changes/:changeId/documents/:id`                                                              |
| Existing id     | Upsert within its change; the same id already stored under another change is refused                                                                               |
| Change upsert   | The agent's file carries `name`, `key`, `type`, `description`; the server sets `status = discovery` and `created_at` on first write and keeps both on later writes |
| Document titles | Free text up to 200 characters, duplicates allowed; `DuplicateDocumentError` and title-derived ids go away                                                         |
| Change keys     | The tracker `key` may repeat across changes; no uniqueness check                                                                                                   |
| Tool names      | `save_change`, `save_document`, `save_design_doc` (every write is an upsert); skills renamed to match                                                              |
| Bad graph file  | `list()` and `get()` throw (no skipping)                                                                                                                           |
| Scope           | Changes, documents, design docs **and** the system model move; `NoesisStore` is deleted                                                                            |
| Migration       | None: old `graph/changes/<slug>/data.json` folders are dev data, deleted by hand                                                                                   |
| HTTP            | The UI surface is read only, so no HTTP route writes; only route params change from slugs to uuids                                                                 |

## Layout

```
.noesis/
  graph/
    changes/
      <changeId>/
        change.json
        <designDocId>.design-doc.json
        <documentId>.document.json
    system-models/
      <systemModelId>.system-model.json
  sessions/
    <sessionId>/
      anything.json            # free form; the tool says which kind it is
```

- The file name repeats the id in the body. On read, a mismatch between the
  file name and `body.id` is a validation failure (a hand-renamed file must not
  silently answer to two ids).
- Use case 4 (summary of a change) is one `readdir` of `changes/<changeId>/`:
  the suffix says the kind, and each file is read for its name.
- `system-models/` replaces `system-model/`; the scanner writes the whole
  directory again on the next scan, so nothing needs moving.

## Ids

New value objects, following the `value-objects` skill (branded Zod schema plus
factories, as `ChangeSlug` does today):

```ts
// app/changes/change-id.ts
const changeIdSchema = z
  .uuid({ version: 'v7' })
  .describe(
    "A change's id: a uuidv7, e.g. '01a0d22d-7f47-76b9-abd4-bd21d66a1d17'. Names the change's directory.",
  )
  .brand<'ChangeId'>();
export const ChangeId = Object.assign(changeIdSchema, {
  mint: () => changeIdSchema.parse(uuidv7()),
});
export type ChangeId = z.infer<typeof changeIdSchema>;
```

- `ChangeId` in `app/changes/change-id.ts`
- `DesignDocId` in `app/design-docs/design-doc-id.ts`
- `DocumentId` in `app/information-sources/document-id.ts` (rewritten; the
  title slugging and `TITLE_PATTERN` go)
- A uuid is only hex digits and dashes, so it can never climb out of a
  directory; the path-safety argument the slugs made still holds.
- `mint()` is used only by tests and fixtures: production ids come from files.
- The system model keeps its own id (a content hash shaped as a uuid, not v7):
  `SystemModel.id` stays a plain string, validated as a file-name-safe
  uuid by the collection.

Removed: `change-slug.ts`, `ChangeSlug`, `DocumentId.fromTitle`,
`change-slug.spec.ts`, `document-id.spec.ts` (rewritten for the uuid VO).

## Models

### Change (`app/changes/change.ts`)

```ts
export const ChangeSchema = z.object({
  id: ChangeId,
  name,
  key,
  type,
  status,
  created_at,
  description, // as today
});

/** What the agent writes: the server owns status and created_at. */
export const ChangeFileSchema = ChangeSchema.pick({
  id: true,
  name: true,
  key: true,
  type: true,
  description: true,
});
```

`CreateChangeSchema` is replaced by `ChangeFileSchema`.

### Document (`app/information-sources/document.ts`)

- `document_id` is renamed to `id: DocumentId`, matching the other entities.
- `title`: `z.string().trim().min(1).max(200)`; the pattern that guaranteed a
  slug goes.
- `CreateDocumentSchema` goes: the working file is the whole `DocumentSchema`,
  id included.

### Design document (`app/design-docs/design-doc.ts`)

- `id: DesignDocId` instead of `z.string()`.
- `CreateDesignDocument` goes: the working file is the whole
  `DesignDocumentSchema`.

### Summaries

`DocumentSummary` and `DesignDocSummary` stay (with `id` typed as the new VOs).
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
`✖ Invalid UUID → at id`).

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
  list(): Promise<T[]>; // unordered; throws on the first broken file
  save(entity: T): Promise<void>; // path from entity.id
  delete(id: string): Promise<boolean>;
  pathOf(id: string): string;
}
```

- `ids()` filters directory entries by the suffix (flat) or by the presence of
  `fileName` (folder); a directory that does not exist yields `[]`.
- Temp files (`*.tmp`) never match the suffix, so they are never listed.
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
  /** The change holding this id, if any: the cross-change upsert guard. */
  changeOf(id: DesignDocId): Promise<ChangeId | null>;
  pathOf(change: ChangeId, id: DesignDocId): string;
}

// DocumentsRepository: same shape as DesignDocsRepository.
```

- Implementation: `new JsonCollection(schema, flatFiles(join(changesDir, changeId), 'design-doc'))`,
  built per call (it holds no state).
- `changeOf` lists change ids and checks for the file under each: a few `stat`s.
- `entries` reads the change folder once and delegates to both collections'
  file reads; or composes `designDocs.list` + `documents.list` (pick the
  simpler during implementation).
- `delete` is dropped from the document and design-doc repositories: nothing
  calls it (no MCP tool, no HTTP route). The collection keeps it for the
  scanner. Knip will confirm.
- `SystemModelStore` becomes `new JsonCollection(SystemModel, flatFiles(noesis.resolve('graph', 'system-models'), 'system-model'))`.

## Services

- `ChangesService`
  - `list()`, `findById(id)`, `assertExists(id)`: as today on ids.
  - `save(file: ChangeFile, now)`: under `Serial`. No uniqueness checks: the
    tracker `key` may repeat across changes. Existing change: keep `status`
    and `created_at`. New change: `status = 'discovery'`, `created_at = now`.
  - `entries(id)`: use case 4.
  - `listNavigation()`: `list()` plus `entries()` per change.
- `DocumentsService` / `DesignDocsService`
  - `save(changeId, doc)`: under `Serial`; `assertExists(changeId)`; refuse
    when `changeOf(doc.id)` is another change (new error
    `EntityInOtherChangeError`); otherwise write. Returns the summary.
  - `list`, `findById`: unchanged apart from ids.
  - `create` / `update` / `delete` and the title checks go.

## MCP tools

Every tool takes a working-file path; nothing is passed inline.

The tools are renamed after what they now do: every write creates or updates.

| Today                                          | After             | Contract                                                    |
| ---------------------------------------------- | ----------------- | ----------------------------------------------------------- |
| `create_change` (inline `name`, `key`, `type`) | `save_change`     | `path` to a `ChangeFileSchema` file                         |
| `add_document_to_change`                       | `save_document`   | `change` (uuid) and `path` to a `DocumentSchema` file       |
| `add_design_doc_to_change`                     | `save_design_doc` | `change` (uuid) and `path` to a `DesignDocumentSchema` file |
| `list_changes`                                 | `list_changes`    | lists ids instead of slugs                                  |

- Tool files and `tool-names.ts` constants follow the new names
  (`save-change.tool.ts`, `SAVE_CHANGE`, …); the server instructions and every
  tool description that names another tool are updated with them.

- Loading a working file, every step answering in-band:
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
  paths stay plain strings: they are built from uuid value objects and are
  safe by construction.

  ```ts
  declare const workingFilePathBrand: unique symbol;
  /** Checked by `resolveWorkingPath`: real, and under `.noesis/sessions/`. */
  export type WorkingFilePath = string & {
    readonly [workingFilePathBrand]: true;
  };
  ```

- `withChange` parses `ChangeId` instead of `ChangeSlug`.
- Tool descriptions tell the agent to put a fresh uuidv7 in `id` for a new
  entity (`bunx uuid v7`, or `Bun.randomUUIDv7()` in a script) and to reuse the
  id to update one.
- New in-band failures: `EntityInOtherChangeError`, id not a uuidv7.

## Plugin skills (`plugins/claude-code/`)

- Skills are renamed with their tools: `create-change` becomes `save-change`,
  `add-document-to-change` becomes `save-document`.
- `save-change` skill: write a change working file with a new uuidv7 (or the
  existing id to update) and pass its path.
- `save-document` skill and `scripts/write-working-file.ts`: add `id`
  (`Bun.randomUUIDv7()`, or `--id <uuid>` to update an existing document); the
  title stays optional-from-heading.
- README and `test/tarball.test.ts` references follow the new tool and skill
  names.

## Indexer and scanner

- `IndexService.collect`: `await changes.list()`, then per change
  `designDocs.list(id)` and `documents.list(id)`; `systemModels.list()`. The
  `objects()` skip helper and the `NoesisStoreError` checks go. A broken file
  now fails the rebuild: the watcher logs it and the previous graph stays, as
  after any failed rebuild.
- Graph rows: `Document.key` (`<change>/<document_id>`) becomes just the id,
  now unique by itself; `change` columns hold the change id.
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
- Plugin README and the `save-document` skill name `.noesis/sessions/<session>/`.
- Specs: `session-dir.spec.ts`, `noesis-dir.spec.ts`, `watcher.spec.ts`,
  `mcp-server.spec.ts`, `mcp.e2e.spec.ts`.
- A leftover `.noesis/tmp/` is not swept by the service (it only sweeps its
  own root); delete it by hand.

## HTTP and frontend

- `/ui/changes/:id`, `/ui/changes/:change/documents/:id`,
  `/ui/changes/:change/design-docs/:id`: params parsed as the new VOs; routes
  stay read only.
- New: `GET /ui/changes/:change/entries` for use case 4 (the overview can use
  it instead of two lists).
- Frontend: `change.slug` becomes `change.id` (sidebar, change picker, last
  opened change, `_shell/index.tsx`, `$changeId.tsx`); `document_id` becomes
  `id`. Route file names already say `$changeId` / `$documentId`.

## Deletions

- `platform/files/noesis-store.ts`, `platform/files/bun-noesis-store.ts`
- `test/.../noesis-store.spec.ts`, `noesis-store.writer.ts`
- `app/changes/change-slug.ts` and its spec
- `app/validation/validator.ts` and `validator.spec.ts`
- `DuplicateDocumentError`, `DuplicateChangeError` (no uniqueness rule is
  left: ids are uuids, titles and keys may repeat)
- The `.noesis/tmp/` session leftovers (by hand)
- The `.noesis/changes/` leftover of an older layout, and today's
  `.noesis/graph/changes/<slug>/` dev data (by hand)

## Steps

Each step leaves the root CI scripts green.

1. Rename `.noesis/tmp/` to `.noesis/sessions/` (session dir, noesis dir,
   watcher, MCP texts, specs) and make `resolveWorkingPath` return a
   `WorkingFilePath`. Independent of the rest, so it goes first.
2. Add `json-file.ts` and `json-collection.ts` with specs (temp dir: flat and
   folder placements, id/name mismatch, broken JSON, schema failure, issue
   cap, atomic write, missing dir).
3. Add `ChangeId`, `DesignDocId`, new `DocumentId` VOs with specs.
4. Switch the models (`id` fields, `ChangeFileSchema`, drop the create
   schemas), repositories, services and indexer to the new store and ids in
   one step; move the system-model store and the scanner.
5. Rewrite and rename the MCP tools to the path-only, upsert contract
   (`save_change`, `save_document`, `save_design_doc`); switch
   `readWorkingFile` to `readJsonFile` and delete `validator.ts` and its spec.
6. HTTP params, `entries` route, frontend `slug` to `id`.
7. Rename and update the plugin skills, script and tests.
8. Delete `NoesisStore`, `ChangeSlug` and dead tests; run knip.
9. Update `docs/arch/ARCHITECTURE.md` where it describes the store, the
   layout and `.noesis/tmp/`.

## Open questions

- Should `list_changes` still show something human-typable, now that a uuid is
  the only handle (the agent copies it, but the user may say "the payment
  retry change")? Today it already prints the name, so probably enough.
