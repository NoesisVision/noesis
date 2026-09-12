---
type: chore
scope: repo
status: built
created: 2026-09-11
---

# Migrate the repository to the target architecture

## Context

[`docs/arch/ARCHITECTURE.md`](../../arch/ARCHITECTURE.md) describes the target
system; decision 68 adopts it, records which earlier decisions it supersedes or
amends, and settles the points the document left open (process model, skills
location, directory name, graph storage, inbox, root discovery, temp dir,
version control, concurrent writers, JVM scanners, picture). This chore is the
mechanical side of that adoption: what changes in the tree, in which order, and
what still has to be decided before each step can start.

The relevant current state, verified on 2026-09-11:

- `server/backend` is a Hono app on `Bun.serve` with three surfaces (`/ui`,
  `/api`, `/internal`), a composition root in `main.ts`, and two graph-backed
  repositories (`design-docs`, `inbox`) over `DatabaseService` and the single
  `GRAPH_SCHEMA` list. The graph is on-disk LadybugDB under `NOESIS_DATA_DIR`,
  with torn-WAL recovery behind `NOESIS_RECOVER_WAL` (decision 62). No file I/O
  anywhere.
- `plugins/mcp-bridge` is a stdio MCP server published as
  `@noesis-vision/mcp-bridge`, launched by the plugin's `.mcp.json` via `bunx`,
  calling `/api/hello` over REST using `@repo/local-contracts` route constants.
  It owns the MCP payload contracts (`src/contracts/`) and generates the
  plugin's `skills/prepare-mcp-data/references/*.json`.
- `plugins/claude-code` ships `.claude-plugin/plugin.json`, `.mcp.json` and one
  skill (`prepare-mcp-data`) that tells the model to read JSON Schema files.
- `packages/shared-contracts` holds the domain zod schemas (conversation,
  document, information fragment, topic, decision, design doc and its ref,
  collaboration and integrity modules), `uuid.ts` (Bun runtime API) and a
  `hello` placeholder. Almost no `.describe()` text; `design-doc-integrity.ts`
  is a code module, not a schema.
- Hosting: `server/backend/Dockerfile`, `railway.json`, the CI bun-version
  guard on the Dockerfile, and `UI_DIST_PATH` as a container setting. The
  release workflow publishes the bridge and the plugin on a `v*` tag.
- `docs/work/features/change-shell.md` plans a `Change` node table with a
  boot-time seed.
- `docs/work/chores/sdlc-migration-plan.md` §2 states the opposite invariant
  ("the server's DB is the single source of truth ... indexer removed").

Boot re-index cost, measured when R2 landed (2026-09-11, `bun run
test:bench` in `server/backend`, Apple Silicon laptop, a full rebuild from
cold over synthetic design docs of ~7 KB spread across 20 changes):

| Files | Rebuild |
| ----- | ------- |
| 1k    | 122 ms  |
| 10k   | 1058 ms |

Within the 2 s working budget at 10k, so the rebuild stays full (no
incremental path) and there is no on-disk cache. The batched `UNWIND`
insert is what keeps it there; one `CREATE` per file was about 5× slower.

## Problem / Goal

The code implements a hosted, graph-authoritative system with a separate MCP
bridge. The target is a local, file-authoritative system with one stdio process
per agent session. Every layer is affected: persistence, process topology,
contract delivery, plugin contents, configuration, hosting, documentation. The
goal is a tree where a reader of `ARCHITECTURE.md` recognises every box in the
code, and no document in `docs/` still describes the previous topology as
current.

## Requirements

Grouped by the architecture section they implement. Each group is meant to be
one reviewable pull request unless noted.

### R1 — Knowledge graph files are the source of truth

- A `FileRepository` per kind under `.noesis/`: `changes/<change>/conversations`,
  `changes/<change>/documents`, `changes/<change>/design-docs`, `system-model`,
  `wiki/topics`, `wiki/decisions`. Each owns its canonical paths and file
  format; nothing else in the backend touches `.noesis/`.
- File naming `<slug>-<id-suffix>.json`; renaming an entity moves the file and
  removes the old path. Only `.json` under the kind directories is graph
  content; other files, and everything under `.noesis/tmp/`, are ignored.
- Writes are whole-file and atomic: write to a sibling temp name in the same
  directory, then rename. Last write wins across processes; no locks, no hash
  preconditions (decision 68, point 9).
- Ids: content hash for imported sources (re-import is detected as a
  duplicate), time-ordered (UUIDv7) for authored entities.
- Cross-file references carry the referenced file's hash at link time; the
  service can report a dependent as stale when the hash no longer matches.
- Locked fields: a per-field marker in the file that skills must preserve.
  Topic and Decision already carry `*_locked`; the migration keeps that
  convention for them and does not change the design-doc shape (see
  Non-goals).
- `DesignDocsRepository` is rewritten over the file repository. The service's
  boundary pipeline (`DesignDocumentSchema.parse → checkDesignDocument`) is
  unchanged.
- A `Change` is the directory `.noesis/changes/<change>/`; listing is a
  directory read, creation is a directory write, and there is no seed. The
  change-shell feature doc's backend section is rewritten to match.
- The inbox subsystem is removed: `src/inbox/`, `src/ui/inbox/`, the
  `InboxItem` table, its specs and its `AppDeps` slice.
- On first run in a repository the service creates `.noesis/` and a
  `.noesis/.gitignore` containing `tmp/`. Every other file under `.noesis/`
  is meant to be committed.

### R2 — The graph is an in-memory cache

- `DatabaseService` opens `:memory:` only. `walPath`, the torn-WAL branch in
  `main.ts`, `NOESIS_RECOVER_WAL` and the README recovery section are removed.
  The single-teardown guard in `shutdown()` stays. (`NOESIS_DATA_DIR` went
  with it: an in-memory database has no directory to configure; R8's
  replacement is only the `NOESIS_ROOT` half.)
- An indexer builds the graph from `.noesis/` at boot and logs how long it
  took and how many files it read. A benchmark spec indexes a synthetic
  `.noesis/` at 1k and 10k files and records the timings in this document's
  Context when it lands; an on-disk cache becomes a task only if boot exceeds
  a stated budget (2 s at 10k files is the working figure).
- A watcher observes
  `.noesis/` (excluding `tmp/`) and re-indexes on any change, including ones
  the service did not make. Debounce and full-versus-incremental rebuild are
  implementation choices; correctness after a `git checkout` while the process
  runs is the test.
- `GRAPH_SCHEMA` stays the single DDL list; its header comment is rewritten
  (it currently says the DB is authoritative and not rebuilt from files).
- Writes go file first; the graph updates only through the watcher. A service
  method that writes must not also write the graph directly.

### R3 — One stdio process per agent session

- `createMcpServer` and the tool table move from `plugins/mcp-bridge/src` into
  `server/backend/src/mcp/`. Tools receive the services they need from the
  composition root and call them directly; no `ServerClient`, no `fetch`.
- `main.ts` connects `StdioServerTransport` and binds the HTTP app on port 0.
  All logging goes to stderr (stdout is the MCP stream). The bound URL is
  logged, and the default browser is opened on it once, unless
  `NOESIS_OPEN_BROWSER=0`.
- Repository root: `NOESIS_ROOT` if set, else walk up from the working
  directory to the nearest `.git`; fail fast with a clear message if neither
  yields a repository. (Pulled forward into R1, which cannot locate `.noesis/`
  without it: `files/repository-root.ts`, `NOESIS_ROOT` in `config.ts`.)
- The `/api` surface, `api.routes.ts`, `GreetingService`, `hello` in the
  contracts, and `@repo/local-contracts` are deleted. The bridge's in-memory
  transport spec and full-stack e2e move with the code and target the backend.
- `plugins/mcp-bridge` is deleted. The service package (`server/backend`)
  gains a `bin` (`noesis`) and publishes as `@noesis-vision/noesis` with the
  built frontend inside; the plugin's `.mcp.json` launches it via `bunx` with
  `NOESIS_ROOT=${CLAUDE_PROJECT_DIR}`.
- The frontend build is served from the package; `UI_DIST_PATH` remains only
  as a development override for the Vite dev server setup.
- Landed 2026-09-12. Two things the plan did not foresee: bun runs a
  dependency's postinstall only when the root project trusts it, and a `bunx`
  install has no root project, so `@ladybugdb/core` never copies its native
  binary into place — the service does that itself at boot
  (`native/ensure-ladybug.ts`), which is why `DatabaseService` now imports the
  module lazily. And `PORT` survives as an optional pin (default ephemeral)
  because the Vite dev proxy needs a fixed target; R8 decides its fate.

### R4 — Temp dir and the import flow

- `.noesis/tmp/<session-id>/` is the scratch area for one service process.
  The service creates its own subdirectory at boot and deletes it on clean
  shutdown; subdirectories left by crashed sessions are swept at boot when
  older than 7 days. Nothing outside the process's own subdirectory is ever
  touched by cleanup.
- Skills write to `.noesis/tmp/` by convention, with no tool call. The MCP
  server's `instructions` field states the repository root and this session's
  scratch directory, which is how the agent learns the session id. Tools
  accept any path under `.noesis/tmp/`.
- Import tools take a working file or directory path, never inline content.
  Results larger than a small threshold are written to `tmp/` and the path is
  returned.
- A `validate` MCP tool takes a contract name and a working file path and
  returns the capped, actionable error list (path into the document, expected
  versus found, one-line correction, count of suppressed issues). The same
  validator runs on every write.
- Landed 2026-09-12. `files/session-dir.ts` owns the scratch directory
  (create, sweep at 7 days, dispose, working-path resolution that follows
  symlinks and accepts any session's directory) and spills results above 8 KB
  to `result-<n>.txt`. `validation/validator.ts` is the one validator: a
  `FileContract` is a zod schema plus an optional integrity check, issues are
  `{ path, expected, found, fix }`, the cap is 20. The tools are `validate`
  and `create-design-doc`, both taking paths; the `hello` placeholder and its
  contract are gone, and `DesignDocsService.create` runs the same contract,
  so the tool and the ui surface reject with the same list. Import payload
  contracts for conversations and documents wait for R5, so the import tool
  set is one kind for now, as R1 was. Not in the plan: a `validate` result
  with issues is a successful call, not an `isError` one — the file was
  validated; only an unreadable path or a rejected write is a tool failure.

### R5 — Contracts the agent reads

- `packages/shared-contracts` is made declarative: `uuid.ts` moves to the
  backend, `design-doc-integrity.ts` moves beside the service that runs it,
  defaults that call functions are removed, every field gets `.describe()`
  text, and imports are zod plus sibling contract files only.
- New schemas: change (directory metadata), wiki topic file, system-model file,
  the reference-with-hash envelope, the locked-field marker, and the import
  payloads (conversation analysis, document analysis) that today live in
  `plugins/mcp-bridge/src/contracts/skills/`.
- A companion document per contract family (how to recognise model-describing
  content, how to choose change-set slots, conventions with no type).
- The service package publishes the `.ts` sources; a build step copies them
  into `plugins/claude-code/contracts/` with a version header, and a test
  asserts byte-identity against the source. `bun run generate` becomes that
  copy step; the CI `generate-check` job keeps its role.
- `plugins/mcp-bridge/tools/generate-references.ts`,
  `skills/prepare-mcp-data/`, and the `toJsonSchema` helper are deleted.
- Landed 2026-09-12. `packages/shared-contracts/src` is now zod plus sibling
  imports only, every field described, no function defaults (`date` on a
  design document is required; the service sets it for the sample). Moved to
  the backend: `ids/uuid.ts`, `design-docs/design-doc-integrity.ts` and the
  ref-resolving functions as `design-docs/design-doc-paths.ts` (the
  `ElementRefSchema` stays a contract). Deleted: `design-doc-collaboration.ts`
  (no consumer since decision 64) and `assert-never.ts`. New contracts:
  `change`, `file-ref`, `locked`, `system-model`, `conversation-analysis` and
  `document-analysis` (the former `analyzed-topic` skill payload, with the id
  left to the service); companion docs `conventions.md`, `change.md`,
  `design-doc.md`, `wiki.md`, `system-model.md`,
  `information-sources/information-sources.md`. The copy step is
  `server/backend/tools/copy-contracts.ts`: `bun run generate` fills
  `plugins/claude-code/contracts/` (committed, drift-checked, byte-identity
  and declarativeness asserted by `plugins/claude-code/test/contracts.test.ts`)
  and `build:contracts` fills the gitignored `server/backend/contracts/` that
  ships in the service package. Revised the same day (decisions 69, 70): the
  plugin copy is a build output too — gitignored except for a README, made
  by the plugin's `bun run build` and on `prepack` — and the service ships
  no copy at all, since nothing read it; the tree holds the sources once
  and one package carries the readable copy. The `validate` tool now accepts every
  registered contract, not only `design-document`. The plugin has no skills
  until R6.

### R6 — Skills

- Knowledge-management skills in the plugin: import conversation, import
  document, create design doc, update design doc, search knowledge graph. Each
  names the contract it needs by a plugin-relative path and follows the
  seven-step import flow of the architecture document (read contract, write
  working file under `.noesis/tmp/`, validate until clean, call the import
  tool with the path).
- Implementation skill: implement design doc.
- Skills preserve locked fields and ask before changing one.
- Nothing is copied into the user's project; skills are plugin content.
- Landed 2026-09-12, with the backend the skills need, which R1 had left for
  later: `sources/sources.repository.ts` (conversations, documents; the file
  repository learned an `idKey` for `conversation_id`/`document_id`),
  `wiki/wiki.repository.ts` (topics, decisions), `imports/import.service.ts`
  (content-hash source ids, duplicate detection across changes, placeholder
  topic ids, locked-field merge, refs rewritten to the stored id and pinned
  to the file hash), `DesignDocsService.update`, graph tables and indexing
  for the four new kinds, and `search/graph-search.ts` as the first (and
  only) search provider, also behind the ui palette. Tools: `list-changes`,
  `import-conversation`, `import-document`, `list-design-docs`,
  `create-design-doc`, `update-design-doc`, `search-knowledge-graph`,
  `validate`. Not in the plan: no `create-change` tool — a change is created
  in the ui, and the change contract's `change.json` is still the
  change-shell feature's work.

### R7 — Scanner

- A TypeScript scanner component in the backend reads the checkout's source and
  writes `system-model/` files plus the graph projection. Its scope for this
  chore is the pipeline (invocation, output files, watcher pickup), not
  language coverage.
- `scanners/java` and `scanners/dotnet` are untouched; their integration is a
  later task once the `system-model/` format is stable.
- Landed 2026-09-12. `scanner/typescript-scanner.ts` finds units (directories
  with a `package.json`, skipping `node_modules`, build output and dot
  directories), projects each into one `system-model/` file — the unit as the
  bounded context, the first directory under `src/` as the module, exported
  classes as building blocks (type by name suffix: Repository, Service,
  Factory, Client/Gateway/Adapter, Event, Command, Query) and their public
  methods as behaviours, every element with `source: { path, line }` — and
  derives ids from names and paths so an unchanged unit re-scans to the same
  file. Extraction is line-based on purpose: the pipeline is the deliverable,
  a parser can replace `exportedClasses` in place. `scanner/scanner.service.ts`
  writes the files and removes those of vanished units; the watcher indexes
  them into the new `SystemModel` table, which search also covers. Invocation
  is the `scan-system-model` tool, on demand — not at boot, since a scan
  touches versioned files. The `system-model.repository.ts` is the kind's
  file repository.

### R8 — Configuration, hosting and CI

- `config.ts`: `NOESIS_DATA_DIR` is replaced by `NOESIS_ROOT` (optional, see
  R3) and `NOESIS_OPEN_BROWSER` (optional). `PORT` is removed; the HTTP port
  is ephemeral.
- Delete `server/backend/Dockerfile`, `railway.json`, the CI bun-version guard
  step, the `railway.json` entry in the CI paths filter, and the deploy-related
  README sections.
- `release.yml` publishes the service package and the plugin instead of the
  bridge and the plugin; the plugin's tarball test asserts the copied contracts
  are present and the `.mcp.json` launches the service bin.
- `scripts/dev-server.sh` keeps working for UI development: the backend runs
  against the current checkout's `.noesis/` with a fixed dev port so the Vite
  proxy has a target.
- Delete `server/backend/.env` and rotate the GitHub App secret it holds.
- Landed 2026-09-12: Dockerfile, `railway.json`, the CI bun-version guard,
  the `railway.json` paths-filter entry and the `deploy` job are gone;
  `server/backend/.env` is deleted locally (it was never committed).
  **`PORT` stays** as an optional pin with an ephemeral default, because the
  Vite dev proxy needs a fixed target; it is not set by the plugin's launch.
  `release.yml` already published the service and the plugin (R3) and the
  plugin's tarball test asserts the copied contracts and the bin (R5). **Not
  done here, needs a person:** rotating the GitHub App client secret and
  private key that the deleted `.env` held (`NOESIS_GITHUB_CLIENT_SECRET`,
  `NOESIS_GITHUB_PRIVATE_KEY`, `NOESIS_TOKEN_KEY`) in the GitHub App
  settings — the auth feature is removed (decision 65), so the App itself can
  be deleted instead.

### R9 — Documentation

- `ARCHITECTURE.md`: drop the `arch.png` line (the Mermaid flowchart is the
  diagram), correct the tree listing to `.noesis/`, add `tmp/` to the layout
  with its ignore rule, and add a short "Process model" section recording
  stdio-per-session, the ephemeral port and the browser open. Delete
  `docs/arch/high_level.png`.
- README architecture section and diagram, `docs/stack.md`, the contracts
  section, the configuration table.
- `sdlc-migration-plan.md` §2 gets a status note pointing at decision 68; the
  rest is historical and stays.
- `change-shell.md`: the change backend section is rewritten to directory
  semantics; the sidebar, routes and styling sections stand.
- Landed 2026-09-12. `ARCHITECTURE.md` gained the "Process model" section
  (the tree listing and `tmp/` were already corrected with decision 68);
  `high_level.png` was already gone from the tree. README: the bridge-era diagram is replaced by
  a pointer to the architecture document and a one-line sketch, the apps
  table and the configuration table match `config.ts`, the scanners section
  describes the in-process TypeScript scanner, and "Deployment" became
  "Distribution" (two npm packages, one tag). `sdlc-migration-plan.md` §2
  carries the status note. `change-shell.md`'s backend section was already
  rewritten with R1. `docs/stack.md` describes only the frontend and needed no
  change.

## Constraints

- Append-only decision log: nothing in 1–67 is edited; decision 68 is the
  record of what changed.
- Every pull request leaves `bun run ci` green. Groups that delete (inbox,
  bridge, hosting) must remove their tests in the same change, not skip them.
- The `/ui` surface keeps its `hc<AppType>` typing and the unbroken `.route()`
  chain; the frontend is untouched except for the change-shell backend section
  when that feature lands.
- stdout of the service process belongs to MCP; every log line goes to stderr.
- The frontend build must still be servable by the backend from a path, since
  the service package ships it.
- No LLM calls anywhere in `server/backend`.
- Contracts published to npm are `.ts` sources; no compiled mirror.

## Non-goals

- Redesigning the design-doc model (change-set combinators, locked fields
  versus authorship, codebase delta). Re-decided together after files-as-truth
  and the system model exist; this chore ships the current normalised shape
  as the file format.
- Language coverage of the scanner beyond the pipeline; JVM and .NET scanner
  integration.
- A long-running daemon, a browser-only mode, or a shared process between
  agent sessions.
- Locks or hash preconditions for concurrent writers.
- Multi-user, remote access, or any trust boundary (decision 65 stands).
- The change-shell UI itself; only its backend section is rewritten here.
- Re-homing the inbox as a file kind.
- An on-disk graph cache; performance work on rebuild or watch.

## Open questions

None. Every point the architecture document left open was resolved on
2026-09-11 (decision 68, "Resolved points"), and the three implementation
questions this document raised — boot re-index cost, temp-dir cleanup, how the
agent learns the temp-dir path — were resolved the same day and folded into R2
and R4. The re-index budget in R2 is a working figure to be replaced by the
measured number.

## Solution options

_Empty by design. Sequencing proposal for the first pass, to be confirmed:_
R8 config and R2 cache first (smallest, unblocks the rest), then R1 files with
design docs as the first kind, then R3 stdio process and MCP fold-in, then R5
contracts and R6 skills together, then R4 temp-dir tools, then R7 scanner
pipeline, then the R8 hosting deletions and R9 docs sweep last so every
intermediate state still builds.
