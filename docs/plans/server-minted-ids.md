# Plan: the server mints entity ids

Today the agent mints the id of a new change, document or design doc with the
plugin's `entity-id.ts` script, writes it into the working file, and every add
tool upserts by that id. This plan moves minting to the server and splits each
upsert tool into a create tool and an update tool. The id shape
(`YYYY-MM-DD-<slug>`, see `dated-entity-ids.md`) and storage stay as they are.

## Decisions

| Topic         | Decision                                                                                                                                                                                                   |
| ------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Who mints ids | The server, on create: today's date, then a slug of the change's or design doc's `name` or the document's `title`. The agent never writes an id                                                            |
| Tools         | One create and one update tool per entity (POST/PUT). No upsert tool is left                                                                                                                               |
| Working file  | Never carries `id`. Its schema is the entity schema with `id` omitted; the update tools take the id as an argument                                                                                         |
| Collisions    | A create never overwrites. When the minted id is taken (same title, same day), the server appends `-2`, `-3`, … and answers with the id it used                                                            |
| Update target | An update of an id that does not exist fails in-band; it never creates                                                                                                                                     |
| Creation date | The server's local calendar date, from an injected `today()` so tests pin it. The service runs on the developer's machine, so this is the date the plugin script used                                      |
| Id stability  | Unchanged: minted once, never re-derived. A rename is an ordinary update at the same id                                                                                                                    |
| Change status | `create_change` takes no `status`: a new change starts in `discovery`. `update_change` keeps today's behaviour (the file carries the status `list_changes` returned; left out, it defaults to `discovery`) |
| Retries       | A retried create makes a second entity (standard POST). No idempotency key for now                                                                                                                         |
| Skill names   | `add-change` and `add-document-to-change` keep their names: they describe what the user wants; each picks the create or update tool                                                                        |

## Models

Each entity keeps its full schema, `id` required: it is what the store holds
and what the wire carries. Beside it, the working-file schemas, derived with
`omit` only:

```ts
// app/changes/change.ts
export const NewChangeSchema = ChangeSchema.omit({ id: true, status: true });
export type NewChange = z.infer<typeof NewChangeSchema>;
export const ChangeContentSchema = ChangeSchema.omit({ id: true });
export type ChangeContent = z.infer<typeof ChangeContentSchema>;

// app/information-sources/document.ts
export const DocumentContentSchema = DocumentSchema.omit({ id: true });
export type DocumentContent = z.infer<typeof DocumentContentSchema>;

// app/design-docs/design-doc.ts
export const DesignDocumentContentSchema = DesignDocumentSchema.omit({
  id: true,
});
export type DesignDocumentContent = z.infer<typeof DesignDocumentContentSchema>;
```

The `.describe()` text on the three `id` fields drops the `entity-id.ts`
sentence and says the server assigns the id when the entity is created and
never changes it.

## Minting (`app/slug-id.ts`)

- The slugify rules move from the plugin's `entity-id.ts` into `slug-id.ts`
  beside `slugIdSchema`: NFKD, strip marks, the transliteration table,
  kebab-case, `untitled` fallback. The test cases move with them.
- `slugIdCandidates(title: string, date: string): Generator<string>` yields
  `2026-09-24-payment-retry`, then `…-payment-retry-2`, `…-3`, … The slug is
  cut so that the date, the slug and the suffix fit the 64 characters.
- Each service parses a candidate with its value-object schema (`ChangeId`,
  `DocumentId`, `DesignDocId`) to get the branded id, and takes the first
  that its repository does not hold.

## Services

All writes stay under each service's `Serial`, so a check for a free id and
the write that takes it are one step, and parallel creates never pick the
same id.

- `ChangesService`
  - `create(change: NewChange): Promise<Change>`: mints the id from `name`,
    sets `status: 'discovery'`, saves.
  - `update(id: ChangeId, change: ChangeContent): Promise<Change>`: throws
    `ChangeNotFoundError` when the id is not on disk, else saves
    `{ id, ...change }`.
  - `add` goes.
- `DocumentsService`
  - `create(change, document: DocumentContent): Promise<DocumentSummary>`:
    `assertExists(change)`, mints the id from `title` within the change, saves.
  - `update(change, id: DocumentId, document: DocumentContent)`: throws the
    new `DocumentNotFoundError` when the id is not in the change.
  - `add` goes.
- `DesignDocsService`: as `DocumentsService`, minting from `name.value`,
  with a new `DesignDocNotFoundError`.
- The `today: () => string` dependency is passed to the three services in
  `boot/services.ts` and pinned in `test/unit/test-noesis.ts`.
- `Added<T>` goes with the upserts.

## MCP tools

| Today                      | After                                                                                        |
| -------------------------- | -------------------------------------------------------------------------------------------- |
| `add_change`               | `create_change(path)`, `update_change(id, path)`                                             |
| `add_document_to_change`   | `create_document_in_change(change, path)`, `update_document_in_change(change, id, path)`     |
| `add_design_doc_to_change` | `create_design_doc_in_change(change, path)`, `update_design_doc_in_change(change, id, path)` |
| `list_changes`             | unchanged; it is where the agent finds the ids to update                                     |

- One file per tool under `adapters/mcp/tools/`, names in `tool-names.ts`.
  `ENTITY_ID_SCRIPT` goes.
- Working files are read with `readWorkingFile` against the content schemas:
  `NewChangeSchema` for `create_change`, `ChangeContentSchema` for
  `update_change`, `DocumentContentSchema` and `DesignDocumentContentSchema`
  for both tools of their entity.
- The `id` argument is the value-object schema itself (`ChangeId`,
  `DocumentId`, `DesignDocId`), so a malformed id is refused by the input
  check. The `change` argument stays a plain string handled by `withChange`,
  as today.
- Annotations: `UPSERT` goes. New in `tool.ts`:
  - `CREATE`: `readOnlyHint: false`, `destructiveHint: false`,
    `idempotentHint: false`, `openWorldHint: false`
  - `UPDATE`: `readOnlyHint: false`, `destructiveHint: true`,
    `idempotentHint: true`, `openWorldHint: false`
- Answers: a create says `Created change 2026-09-24-payment-retry (…). Refer
to it by this id.` and returns the entity or summary, id included. An update
  says `Updated …`. The `created` flag goes from the output schemas.
- New in-band failures: an update of an unknown id says so and hints at
  `list_changes` (or the matching create tool).
- `change-scoped.ts`: `idInstructions` goes; `addToChangeInput` becomes the
  input builders of the create and update tools; the file-shape texts drop
  `"id"`.
- The server instructions in `mcp-server.ts` name the new tools where they
  name the old ones.

## Contracts (`tools/contracts.ts`)

The contracts are the working files an agent writes:

| Today             | After                                                                     |
| ----------------- | ------------------------------------------------------------------------- |
| `change`          | `new-change` (`NewChangeSchema`) and `change` (`ChangeContentSchema`)     |
| `document`        | `document` (`DocumentContentSchema`)                                      |
| `design-document` | `design-document` (`DesignDocumentContentSchema`); the example drops `id` |
| `system-model`    | unchanged                                                                 |

The comment at the top of `contracts.ts` changes from "id included: the
writer mints the id" to "never an id: the server mints it". The contract
specs follow.

## Plugin (`plugins/claude-code/`)

- Delete `scripts/entity-id.ts` and `test/entity-id.test.ts`.
- `add-change` skill: to create, write `new-change.schema.json` and call
  `create_change`; to update, write `change.schema.json` and call
  `update_change` with the id from `list_changes`.
- `add-document-to-change` skill and `scripts/write-working-file.ts`: no `id`
  in the working file and no `--id` flag. The skill passes the stored id to
  `update_document_in_change` when it updates.
- Design docs: the agent writes the file without an id and calls the create
  or update tool.
- README, contracts README and `test/tarball.test.ts` follow the tool names
  and the deleted script.

## Deletions

- `plugins/claude-code/scripts/entity-id.ts` and its test
- `ENTITY_ID_SCRIPT`, `idInstructions`, `UPSERT`, `Added<T>`
- The three `add` service methods and the three `add_*` tools

## Steps

Each step leaves the root CI scripts green.

1. Move the slugify rules and their test cases into `slug-id.ts` with
   `slugIdCandidates`.
2. Add the content schemas (with their first users, so knip stays green),
   `create` / `update` on the three services, the `today` dependency and
   the not-found errors, with specs (id minted from the title; `-2` on a
   same-day title; update of an unknown id throws; parallel creates of one
   title get different ids).
3. Replace the three `add_*` tools with the six create and update tools, the
   annotations and the answers; update `mcp-server.spec.ts` and
   `mcp.e2e.spec.ts`. Remove the `add` service methods and `Added<T>`.
4. Regenerate the contracts; update the plugin skills, scripts, README and
   tests; delete `entity-id.ts`.
5. Update `AGENT.md` and `docs/arch/ARCHITECTURE.md` where they describe who
   mints ids and the tools. Run knip.

## Settled

- The minting date is the server's local date. The service runs next to the
  agent, so it is the same day the plugin script picked; a hosted service
  would need to revisit this.
- The same title on the same day now makes two entities instead of silently
  overwriting one. The suffix makes the second visible in its id.
