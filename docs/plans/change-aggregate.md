# Plan: a change is an aggregate stored in one file

Today a change is `graph/changes/<id>.change.json`, and what it owns sits in
`graph/changes/<id>/` as one file per design document (`<id>.design-doc.json`)
and per source document (`<id>.document.json`), each behind its own
repository. This plan makes the change an aggregate root that owns its design
documents and source documents, stored whole in `<id>.change.json`.

## Decisions

| Topic       | Decision                                                                                                                                              |
| ----------- | ----------------------------------------------------------------------------------------------------------------------------------------------------- |
| Storage     | `graph/changes/<id>.change.json` holds the change, its design documents and its source documents. The `<id>/` directory goes away                     |
| Migration   | None. The old layout is dropped outright                                                                                                              |
| Aggregate   | A rich `Change` class wrapping its state. It mints child ids, enforces the design-doc rules and answers not-found for its children                    |
| App layer   | Command and query handlers under `app/changes/`. `app/design-docs/` and `app/information-sources/` fold into it; the services go away                 |
| Concurrency | Optimistic: the file carries a `version`; a save whose loaded version no longer matches the stored one fails. No `Serial` is left                     |
| Conflict    | Surfaced to the caller, never retried silently: 409 over HTTP, an MCP tool error saying to reload and retry                                           |
| Version     | Starts at 1 on create. A file without it fails to read                                                                                                |
| Order       | Changes newest first; design documents and source documents oldest first (by id)                                                                      |
| Contracts   | Cleaned up where the aggregate suggests it: change reads carry children, list routes per kind go away, `document` becomes `source-document` in routes |
| Tool names  | `add_design_doc_to_change`, `update_design_doc_in_change`, `add_document_to_change`, `update_document_in_change`                                      |
| Delivery    | Several commits on one branch, in the order below                                                                                                     |

## Stored shape

```json
{
  "id": "2026-09-24-payment-retry",
  "name": "Payment retry",
  "key": "NOE-142",
  "type": "feature",
  "status": "design",
  "description": "...",
  "version": 7,
  "designDocs": [
    { "id": "2026-09-24-partial-refunds", "name": "...", "modules": {} }
  ],
  "sourceDocuments": [
    {
      "id": "2026-09-24-meeting-notes",
      "title": "...",
      "date": "2026-09-24",
      "content": "..."
    }
  ]
}
```

## Domain (`app/changes/`)

- `ChangeSnapshot`: the Zod schema of the stored shape, built from the
  metadata fields, `version`, `designDocs: DesignDoc[]` and
  `sourceDocuments: SourceDocument[]`. Today's `Change` schema is renamed to it,
  since the class takes the name. `CreateChange` and `UpdateChange` derive from
  it by pick/omit and stay metadata only, so an update never touches children.
- `DesignDoc` and `SourceDocument` keep their schemas; the files move into
  `app/changes/`.
- `Change` class:
  - `static fromSnapshot(snapshot)`, `toSnapshot()`, `id`, `version`
  - `update(meta: UpdateChange)`
  - `addDesignDoc(file, today)`: mints the id from `slugIdCandidates` against
    its own design-doc ids (synchronous), checks
    `DesignDoc.validateAgentGenerated` and throws `InvalidDesignDocError`
  - `reviseDesignDoc(id, file)`, `designDoc(id)` (throws `NotFoundError`),
    `designDocSummaries()`
  - `addSourceDocument(file, today)`, `reviseSourceDocument(id, file)`,
    `sourceDocument(id)`, `sourceDocumentSummaries()`
  - `entries()`: the navigation entries, design documents then source documents
- `ChangeGuard` goes away: a handler that loads the aggregate gets the
  not-found check for free.

## Persistence

- `ChangesRepository`: `get(id): Change | null`, `list(): Change[]`,
  `save(change)`.
- `save` re-reads the stored `version`; when it differs from the version the
  change was loaded with it throws `ConcurrentModificationError`, otherwise it
  writes `version + 1` through the atomic rename in `writeJsonFile`.
- The check and the rename are not one step. That is enough for one local
  process and a `git checkout` under it; the repository's JSDoc says so.
- Deleted: `ChangeOwnedRepository`, `DesignDocsRepository`,
  `SourceDocumentsRepository`, `SourceDocumentsReader`, `Serial` (with
  `serial.ts` if nothing else uses it).

## Handlers (`app/changes/`)

- Commands: `CreateChange`, `UpdateChange`, `AddDesignDocToChange`,
  `UpdateDesignDocInChange`, `AddDocumentToChange`, `UpdateDocumentInChange`.
  Each loads the change, calls the aggregate, saves and answers a summary.
- Queries: `ListChanges` (changes with their entries), `FindChange` (metadata
  plus design-doc and source-document summaries), `FindDesignDoc`,
  `FindSourceDocument`.
- `CreateChange` still checks the id across changes through `repo.get`
  (`freeSlugId`).
- Removed: `ChangesService`, `DesignDocsService`,
  `ListSourceDocumentsForChangeHandler`.

## Contracts

- HTTP (`/ui/changes`):
  - `GET /` merges with `/navigation`: changes with their entries.
  - `GET /:id`: the change with its design-doc and source-document summaries.
  - Dropped: `GET /:change/design-docs` and `GET /:change/documents`.
  - `GET /:change/documents/:id` becomes `GET /:change/source-documents/:id`.
  - `ConcurrentModificationError` maps to 409.
- MCP:
  - `list_changes` returns each change's entries; a design-doc entry carries
    `implemented`.
  - `create_design_doc_in_change` becomes `add_design_doc_to_change`;
    `create_document_in_change` becomes `add_document_to_change`. The update
    tools keep their names.
  - Tool descriptions and working-file JSON Schemas updated.
  - A conflict answers a tool error: reload and retry.
- Frontend:
  - `changes.api` drops the plain list and reads the merged route.
  - The design-docs and documents list views read from the `changeById` query.
  - `features/documents` becomes `features/source-documents`; query keys follow.

## Commits

1. `improvement(server): model a change as an aggregate of its documents`:
   `ChangeSnapshot`, the `Change` class, unit tests ported from
   `design-docs.service.spec`, `source-document-commands.spec` and
   `changes.service.spec`.
2. `improvement(server): store a change and its documents in one file`: the
   repository with the version check, `changes.repository.spec` rewritten,
   `ChangeOwnedRepository` deleted.
3. `improvement(server): handle change commands on the aggregate`: the
   handlers, `boot/services.ts` rewired, the old services and repositories
   deleted.
4. `improvement(server): return change children from change reads`: the route
   and MCP contract changes and renames, with route, MCP and e2e specs.
5. `improvement(frontend): read change children from the change`.
6. Cleanup: knip, dead exports, docs and `AGENT.md` mentions of the storage
   layout and tool names.

## Verification

Run the root CI scripts (typecheck, lint, knip, tests across all workspaces)
before pushing; check CI after.
