# Plan: dated slug ids for changes, documents and design docs

Key every change, document and design doc by its creation date plus a slug of
its title (`2026-09-24-payment-retry`), minted by the writer of the file, and
make every write an upsert by that id. This plan changes the models and the
contracts (MCP tools, plugin scripts, HTTP params, frontend); storage stays on
today's `NoesisStore`, which takes the new ids as keys unchanged. The storage
rework is a separate plan (`storage-layout-c.md`) that assumes this one is done.

## Decisions

| Topic           | Decision                                                                                                                                                                                                        |
| --------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Ids             | `YYYY-MM-DD-<slug>`: the creation date, then a slug of the change's or design doc's `name` or the document's `title`. One shape for changes, documents and design docs; the system model keeps its content hash |
| Id scope        | A change id is unique among changes; a document or design-doc id is unique only within its change (the same `2026-09-24-refund-flow` may exist in two changes)                                                  |
| Why dated       | Fewer collisions than a bare slug, ids sort by creation date, and the files stay readable when edited by hand                                                                                                   |
| Who mints ids   | The writer of the file: a plugin script derives the id from the title and today's date and puts it in the body. Every entity, the change included, reaches the server as a session file                         |
| Existing id     | Every save is an upsert: an id already on disk is an update. The same title on the same day therefore overwrites the earlier entity; the scripts warn when the target already exists                            |
| Id stability    | Immutable: the id is minted once, at creation, and never re-derived. A title or name change is an ordinary update at the same id; the id keeps the original title                                               |
| Get by id       | Nested: `get(changeId, id)`; HTTP routes stay `/changes/:changeId/documents/:id`                                                                                                                                |
| Change upsert   | The agent's file carries `id`, `name`, `key`, `type`, `description`; the server sets `status = discovery` and `created_at` on first write and keeps both on later writes                                        |
| Design doc name | No new field: the id slugs the existing reviewable `name.value`. The id is immutable, so a later `name` edit is an ordinary update                                                                              |
| Document titles | Free text up to 200 characters, duplicates allowed on different days; `DuplicateDocumentError` and title-only ids go away                                                                                       |
| Change keys     | The tracker `key` may repeat across changes; no uniqueness check                                                                                                                                                |
| Default order   | Lists are sorted by id, so by creation date, then title                                                                                                                                                         |
| Tool names      | `save_change`, `save_document`, `save_design_doc` (every write is an upsert); skills renamed to match                                                                                                           |
| Storage         | Unchanged: `NoesisStore` keyed by the dated ids (they match its `KEY_PATTERN`)                                                                                                                                  |
| Migration       | None: today's `graph/changes/<slug>/` folders are dev data, deleted by hand                                                                                                                                     |
| HTTP            | The UI surface is read only, so no HTTP route writes; route params become dated ids                                                                                                                             |

## Ids

One shape, three brands. A shared helper in `app/ids/dated-id.ts` builds the
schema; each entity gets its own value object, following the `value-objects`
skill:

```ts
// app/ids/dated-id.ts
/** Room for the date prefix inside the 64 characters a path segment gets. */
const MAX_LENGTH = 64;
/** Zod's own `z.iso.date()` regex, leap years included, without its anchors. */
const DATE = z.core.regexes.date.source.slice(1, -1);
const SLUG = '[a-z0-9]+(?:-[a-z0-9]+)*';
const DATED_ID_PATTERN = new RegExp(`^${DATE}-${SLUG}$`);

export function datedIdSchema(subject: string) {
  return z
    .string()
    .max(MAX_LENGTH)
    .regex(
      DATED_ID_PATTERN,
      `Invalid ${subject} id: expected e.g. '2026-09-24-payment-retry'`,
    )
    .describe(
      `A ${subject}'s id: its creation date, then its title as lower-case kebab-case, e.g. '2026-09-24-payment-retry'. Names its file.`,
    );
}

// app/changes/change-id.ts
const changeIdSchema = datedIdSchema('change').brand<'ChangeId'>();
export const ChangeId = changeIdSchema;
export type ChangeId = z.infer<typeof changeIdSchema>;
```

- `ChangeId` in `app/changes/change-id.ts` (replaces `ChangeSlug`)
- `DesignDocId` in `app/design-docs/design-doc-id.ts`
- `DocumentId` in `app/information-sources/document-id.ts` (rewritten; the
  title slugging and `TITLE_PATTERN` go)
- Only `[a-z0-9-]`, so an id can never climb out of a directory.
- The regex is the whole rule. No `.refine()`: `contracts-json-schema.spec.ts`
  refuses one under `src/app/`, because `z.toJSONSchema` drops it silently and
  the plugin's contract would then accept `2026-13-45-x` that the server
  rejects. Zod's date regex states the real-date rule in `pattern` instead, so
  the contract and the server agree, and `2026-02-30-x` is rejected by both.
- An id is immutable. The server never derives or changes one: it only
  validates it, and a save at an existing id updates that entity whatever its
  new title. Updating means reusing the stored id; the scripts take `--id` for
  that and never re-slug the title. The id can therefore drift from the
  current title, by design.
- Minting is the plugin's job. The slugify rules (NFKD, strip marks,
  transliterate `ł`, `ß`, …, kebab-case, `untitled` fallback) move to the
  plugin (see Plugin skills). The slug part is cut so the whole id fits in 64
  characters.
- The date is the writer's local date, taken when the script mints the id. The
  server does not compare it with `created_at` (a change created just after
  midnight UTC may differ by a day).
- Tests and fixtures use literal ids (`'2026-01-01-payment-retry'`); there is
  no `mint()`.
- The system model is out of scope: it keeps its content-hash id.

Removed: `change-slug.ts`, `ChangeSlug`, `DocumentId.fromTitle`,
`change-slug.spec.ts`, `document-id.spec.ts` (rewritten for the dated VO).

## Models

### Change (`app/changes/change.ts`)

```ts
export const ChangeSchema = z.object({
  id: ChangeId, // was `slug`
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
  slug goes (the script falls back to `untitled` for the id).
- `date` stays: when the document was last revised, independent of the
  creation date in its id.
- `CreateDocumentSchema` goes: the working file is the whole `DocumentSchema`,
  id included.

### Design document (`app/design-docs/design-doc.ts`)

- `id: DesignDocId` instead of `z.string()`.
- No new field: the id is minted from `name.value`, the design doc's
  existing reviewable name.
- `CreateDesignDocumentSchema` goes: the working file is the whole
  `DesignDocumentSchema`.

### Summaries

`DocumentSummary`, `DesignDocSummary` and `ChangeNavigationItem` keep their
shape, with `id` typed as the new VOs (`slug` becomes `id`).

## Repositories

Today's repositories and `NoesisStore` stay; only the key types change:

- `ChangeSlug` becomes `ChangeId`, the design-doc key `string` becomes
  `DesignDocId`, and the store key of a change is `change.id`.
- On disk: `graph/changes/<changeId>/data.json`, with
  `design-docs/<designDocId>/data.json` and `documents/<documentId>/data.json`
  under it.
- `NoesisChangesRepository.keys()` parses `ChangeId` instead of `ChangeSlug`
  (and keeps skipping what does not parse, as today).

## Services

- `ChangesService`
  - `list()`, `findById(id)`, `assertExists(id)`: as today, on the dated id;
    `list()` sorted by id.
  - `save(file: ChangeFile, now)`: under `Serial`, upsert by `id`. No
    uniqueness checks: an id already on disk is an update, and the tracker
    `key` may repeat across changes. Existing change: keep `status` and
    `created_at`. New change: `status = 'discovery'`, `created_at = now`.
    Replaces `create`.
- `DocumentsService` / `DesignDocsService`
  - `save(changeId, doc)`: under `Serial`; `assertExists(changeId)`; write.
    Returns the summary. No cross-change check: ids are scoped to their change.
  - `list` (sorted by id), `findById`: unchanged apart from the dated ids.
  - `create` / `update` / `delete` and the title checks go.

## MCP tools

Every tool takes a working-file path; nothing is passed inline. The tools are
renamed after what they now do: every write creates or updates.

| Today                                          | After             | Contract                                                  |
| ---------------------------------------------- | ----------------- | --------------------------------------------------------- |
| `create_change` (inline `name`, `key`, `type`) | `save_change`     | `path` to a `ChangeFileSchema` file                       |
| `add_document_to_change`                       | `save_document`   | `change` (id) and `path` to a `DocumentSchema` file       |
| `add_design_doc_to_change`                     | `save_design_doc` | `change` (id) and `path` to a `DesignDocumentSchema` file |
| `list_changes`                                 | `list_changes`    | lists dated ids instead of slugs                          |

- Tool files and `tool-names.ts` constants follow the new names
  (`save-change.tool.ts`, `SAVE_CHANGE`, …); the server instructions and every
  tool description that names another tool are updated with them.
- The working file is loaded with today's `readWorkingFile` (session dir
  check, size limit, validator report); `save_change` now uses it too.
  `withChange` parses `ChangeId` (not for `save_change`).
- Tool descriptions tell the agent to get the id of a new entity from the
  plugin's `entity-id.ts` script and to reuse the existing id to update one.
  An id already in use overwrites that entity, so the agent checks
  `list_changes` (or the change's lists) first.
- New in-band failure: id not a dated id.

## Plugin skills (`plugins/claude-code/`)

- Skills are renamed with their tools: `create-change` becomes `save-change`,
  `add-document-to-change` becomes `save-document`.
- New `scripts/entity-id.ts` at the plugin root: `entityId(title, date)` and a
  CLI (`bun entity-id.ts "<title>"` prints `2026-09-24-<slug>`). It holds the
  slugify rules moved from `ChangeSlug.fromName` and `DocumentId.fromTitle`
  (NFKD, strip marks, transliterate `ł`, `ß`, …, kebab-case, `untitled`
  fallback, cut to fit 64 characters). Plugin scripts are standalone, so the
  function is copied with its test cases, not imported from the server.
- With `--change <id> --kind <document|design-doc|change>` the CLI also warns
  on stderr when an entity with that id already exists under
  `.noesis/graph/` (a same-day, same-title save would overwrite it). The
  existence check goes through one helper that knows today's paths, so the
  storage plan changes it in one place.
- `save-change` skill: write the change working file with the id from
  `entity-id.ts` (or the existing id to update) and pass its path.
- `save-document` skill and `scripts/write-working-file.ts`: add `id` from
  `entityId` (or `--id <id>` to update an existing document); the title stays
  optional-from-heading.
- Design docs: the agent writes the file itself; the tool description points
  it at `entity-id.ts` for the id, minted from the design doc's `name`.
- README and `test/tarball.test.ts` references follow the new tool and skill
  names.

## Indexer

- `IndexService.collect` reads changes by `ChangeId`; graph rows keep their
  shape: `Document.key` stays `<change>/<id>` (ids are unique only within a
  change); `change` columns hold the change id.

## HTTP and frontend

- `/ui/changes/:id`, `/ui/changes/:change/documents/:id`,
  `/ui/changes/:change/design-docs/:id`: params parsed as the dated-id VOs;
  routes stay read only.
- Frontend: `change.slug` becomes `change.id` (sidebar, change picker, last
  opened change, `_shell/index.tsx`, `$changeId.tsx`); `document_id` becomes
  `id`. Lists keep the server's id order
  instead of sorting by name. Route file names already say `$changeId` /
  `$documentId`.

## Deletions

- `app/changes/change-slug.ts` and its spec (the slugify rules move to the
  plugin's `entity-id.ts`)
- `CreateChangeSchema`, `CreateDocumentSchema`, `CreateDesignDocumentSchema`
- `DuplicateDocumentError`, `DuplicateChangeError` (no uniqueness rule is
  left: saves are upserts by id, titles and keys may repeat)
- Today's `.noesis/graph/changes/<slug>/` dev data (by hand)

## Steps

Each step leaves the root CI scripts green.

1. Add `datedIdSchema`, `ChangeId`, `DesignDocId` and the new `DocumentId`
   VOs with specs (accept `2024-02-29-x`; reject `2026-02-29-x`, `2026-02-30-x`,
   `2026-13-01-x`, a bare slug, upper case, a 65-character id; the JSON
   Schema `pattern` equals the regex source).
2. Switch the models (`id` fields, `ChangeFileSchema`,
   drop the create schemas), repositories, services and indexer to the new
   ids and upsert semantics in one step.
3. Rewrite and rename the MCP tools to the path-only, upsert contract
   (`save_change`, `save_document`, `save_design_doc`).
4. HTTP params, frontend `slug` and `document_id` to `id`.
5. Add `entity-id.ts`; rename and update the plugin skills, scripts and tests.
6. Delete `ChangeSlug` and dead tests; run knip.
7. Update `docs/arch/ARCHITECTURE.md` where it describes ids and the tools.

## Open questions

- Same-day, same-title saves overwrite by design (upsert). Is the script's
  warning enough, or should the server refuse a new-looking save (for a
  change, a differing `created_at` date) at an id already on disk? A differing
  title alone is never a reason to refuse: it is a normal rename.
