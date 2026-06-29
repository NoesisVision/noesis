# SDLC → noesis Migration Plan

_Status: plan of record. Date: 2026-06-29._

This document plans migrating the feature set of the **SDLC** repository
(`/home/marcin/Noesis/Repositories/SDLC`) into this clean **noesis** Turborepo
monorepo, adjusting it to noesis's architecture (the app boundaries differ).

## How to read this document

- **Source repo** = SDLC. Everything lives in one package under
  `src/agent_extensions/plugins/noesis/`. It is **mid-refactor**: `NEW-DESIGN.md`
  describes the intended clean model, but the working tree still carries legacy
  services, a `noesis-backup/` directory, and `*New` shadow classes. The code is
  explicitly _not_ clean yet.
- **Target repo** = noesis. Clean Turborepo with `apps/{server,ui,local}`,
  `packages/*-contracts`, `plugins/claude-code`, `scanners/`. Today it implements
  only a trivial `hello` flow; everything else is scaffolding plus a 21-entry
  architecture decision log (`docs/decisions.md`).

**Guiding principle (from the user):** _everything must be clean from the start._
Two consequences run through the whole plan:

1. **Migrate the NEW-DESIGN model, not the legacy code.** We port SDLC's
   _intended_ design (the rules in `NEW-DESIGN.md` + the domain contracts), not
   its current half-refactored services and never `noesis-backup/`. In practice
   most files are rewritten against noesis conventions rather than copied.
2. **No design invention.** Where a decision is genuinely open it is captured as
   an **Open Question (OQ)** assigned to a part, with options and a
   recommendation — but the choice is yours. Nothing downstream of an unanswered
   OQ should be implemented.

Each **Part** is sized for a single human review pass (roughly one focused PR).
Parts are ordered by dependency. The foundational architecture is now **decided**
(see §2) and every part is written against it.

---

## 1. What exists on each side

### 1.1 noesis (target) — established architecture

| Concern             | Decision (see `docs/decisions.md`)                                                                                                     |
| ------------------- | -------------------------------------------------------------------------------------------------------------------------------------- |
| App split           | `apps/server` (NestJS REST, owns DB, serves UI), `apps/ui` (React/Vite), `apps/local` (stdio MCP, calls server over REST)              |
| Route surfaces      | `/ui/*`, `/api/*`, `/internal/*` — one Nest module each, auth per surface (18)                                                         |
| MCP server          | `apps/local/src/mcp.ts`: Nest **application context** (no HTTP), stdio transport, calls server over REST via `ServerClientService` (8) |
| Contracts           | zod-only, consumed as TS source; `shared-`/`ui-`/`local-`/`mcp-contracts` packages (3, 4)                                              |
| Plugin distribution | `plugins/claude-code` published to npm; MCP server bundled into `servers/noesis-local.js` (9, 14, 15, 16)                              |
| Deployment          | `server` + `ui` as one Railway service via Dockerfile + CI `railway up` (17, 18)                                                       |
| DB                  | on-disk LadybugDB graph, embedded in the server; **the source of truth** (see §2)                                                      |
| Scanners            | out-of-process, ship graph facts; Java = ArchUnit + Spoon (19, 20); `scanners/dotnet` a stub                                           |

### 1.2 SDLC (source) — feature inventory

One process (`mcp/noesis-graph/server.ts`) boots NestJS HTTP (`app.listen(0)`),
the stdio MCP server, the LadybugDB connection, and opens the UI in a browser —
all per project, launched by Claude Code with `NOESIS_PROJECT_DIR=$(pwd)`.

| Subsystem                    | What it does                                                                                                                           | Key paths (under `mcp/noesis-graph/` unless noted) |
| ---------------------------- | -------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------- |
| **Database**                 | LadybugDB (`lbug`) embedded graph DB, Cypher-like, on-disk at `${dataDir}/ladybug-db`                                                  | `database/database.service.ts`                     |
| **Knowledge: conversations** | ingest `analyze-conversation` output, split to source content, index, serve UI                                                         | `knowledge/conversations/*`                        |
| **Knowledge: documents**     | ingest `analyze-design-draft` output (incl. design-doc + decision attachments)                                                         | `knowledge/documents/*`                            |
| **Knowledge: topics**        | topic tree, manual edits, staleness via per-item `source_sha`                                                                          | `knowledge/topics/*`                               |
| **Knowledge: decisions**     | decision slots (context/decision/alternatives), manual edits, staleness                                                                | `knowledge/decisions/*`                            |
| **Knowledge: design-docs**   | nested DDD model, per-field locks at every level, actors, "implemented" lock                                                           | `knowledge/design-docs/*`                          |
| **Knowledge: schema**        | exposes the graph schema for the schema explorer                                                                                       | `knowledge/schema/*`                               |
| **Indexer**                  | startup consistency check + file watcher; DB-as-cache. **Not migrated** (see §2)                                                       | `indexer/*`                                        |
| **Scanner + invocations**    | C# static analysis, DDD-annotation detection, behaviour-level invocation graph                                                         | `scanner/*`, `scanner/invocations/*`               |
| **Implementation-check**     | compare a design doc against scanned code                                                                                              | `implementation-check/*`                           |
| **Serena**                   | port to the Serena symbol/LSP tool                                                                                                     | `serena/*`                                         |
| **Domain contracts**         | zod schemas: conversation, document, topic, decision, design-doc, source-content, idea-unit                                            | `../../shared-contracts/*`                         |
| **Skill output contracts**   | zod schemas for each skill's `output.json`                                                                                             | `../../shared-contracts/skills/*`                  |
| **UI contracts**             | TS interfaces (not zod) for each UI page/detail view                                                                                   | `ui-contracts/*`                                   |
| **UI**                       | React 19 + Vite + Mantine + `@xyflow/react`: conversations, documents, topics, decisions, design-docs, model-explorer, schema-explorer | `ui/src/*`                                         |
| **Skills**                   | `analyze-conversation`, `analyze-design-draft`, `create-design-doc`, `implement-design-doc`, `search-topics`, `clarify-requirements`   | `../skills/*`                                      |
| **Prepare scripts**          | transcript/document preprocessing (sentence segmentation, markdown fragmenting) run before skills                                      | `../scripts/{conversation,document}/*`             |

---

## 2. Target architecture (decided)

The foundational topology is settled. SDLC's defining assumption — _project files
on the developer's disk are the source of truth, and the DB is a cache of them_ —
**does not carry over.** In noesis the **server's DB is the single source of
truth**; there are no project files acting as a second data source. This removes
the file-watcher/indexer subsystem entirely and reshapes where each piece of
logic runs.

### 2.1 The three apps

- **`apps/server`** — independently deployed, long-running, **single remote
  instance**. Owns the on-disk LadybugDB (the source of truth), serves `/ui/*`,
  `/api/*`, `/internal/*`. **Multi-tenant**: serves many users and many projects
  from one deployment. All domain services, the DB, and merge/persistence logic
  live here.
- **`apps/local`** — a thin **stdio MCP adapter**, started and owned by the AI
  agent (Claude Code), one process per agent session. **Many local instances
  connect to the one server** over REST. It has two jobs:
  1. **Write path** — translate skill outputs (`output.json` produced locally)
     into calls to the server's `/api/*` surface.
  2. **Read path** — expose the server's capabilities to the AI agent as
     MCP-friendly tools (query topics, fetch design docs, etc.).
     It holds **no domain logic and no DB**; it is purely an adapter.
- **`apps/ui`** — React/Vite app talking to the server's `/ui/*` surface, used by
  **multiple concurrent users**.

### 2.2 Consequences that run through every part

These follow directly from §2.1 and supersede SDLC's file-centric assumptions:

1. **DB is authoritative, not a cache.** Repositories persist knowledge
   artifacts to LadybugDB **only**. There is **no file I/O** for conversations,
   documents, topics, decisions, or design docs. (SDLC's "repository does both DB
   and source-file I/O" collapses to "repository does DB I/O.")
2. **No indexer / no file watcher.** The `indexer/*` subsystem is **not
   migrated**. There are no project files to watch and nothing to re-derive from
   disk. Work the indexer used to coordinate — staleness recompute — happens
   **synchronously inside the owning service at ingest/merge time** instead.
3. **`local`↔`server` is a network REST hop.** They run on different machines.
   Skill output is sent to the server as **content in the REST body**, never as a
   filesystem path. (This resolves what was the path-vs-content question.)
4. **On-disk LadybugDB in the server.** Persistence survives restarts for free.
   Because it is now the source of truth (not a rebuildable cache), there is no
   cold-rebuild-from-files fallback — see backup/durability note in §2.4.
5. **Multi-tenancy is in scope.** Every artifact is scoped to a **project**, and
   the server handles concurrent access from multiple users and from multiple
   agents of a single user. This introduces project identity, per-surface auth,
   and concurrent-write handling (Part 2 OQs).

### 2.3 Where each subsystem physically lives

| Subsystem                                                                                 | Lives in                           | Notes                                          |
| ----------------------------------------------------------------------------------------- | ---------------------------------- | ---------------------------------------------- |
| LadybugDB + schema                                                                        | `apps/server`                      | on-disk, source of truth, multi-tenant         |
| Domain services + repositories (conversations, documents, topics, decisions, design-docs) | `apps/server`                      | persist to DB only                             |
| Merge / staleness recompute                                                               | `apps/server`                      | runs at ingest time within services            |
| `/ui`, `/api`, `/internal` controllers                                                    | `apps/server`                      | auth per surface                               |
| MCP tool registration + `ServerClientService`                                             | `apps/local`                       | calls `/api` over REST                         |
| Skill execution + prepare scripts (segmentation, fragmenting)                             | developer machine (plugin)         | output sent to server as content               |
| Scanner (C#) + invocation facts                                                           | developer machine (out-of-process) | ships graph facts to server (deferred, Part 9) |
| Indexer / file watcher                                                                    | —                                  | **removed**                                    |
| UI                                                                                        | `apps/ui`                          | talks to `/ui`                                 |

### 2.4 Foundational decisions (record of §2)

These are the answers that shape the rest of the plan. They are stated here as
the plan's record (the canonical decision log in `docs/decisions.md` is updated
separately and is out of scope for this document):

- **DB ownership:** server owns the DB; the DB is the source of truth; no project
  files as a second data source; **indexer removed.**
- **Topology:** server is remote, single-instance, independently deployed;
  `local` is a per-agent stdio MCP adapter; many `local` → one `server`.
- **Persistence:** on-disk LadybugDB. (Open follow-up: because the DB is now
  authoritative, a **backup/durability** story is needed — there is no
  rebuild-from-files fallback. Tracked under OQ-2.3.)
- **Scale:** multi-user + multi-agent + multi-UI-user concurrency in scope →
  project scoping, auth, and concurrent writes are first-class (Part 2).
- **Supersedes:** decision 17's "DB is an in-memory cache of files" framing —
  now on-disk and authoritative.

---

## 3. Cross-cutting conventions (apply in every part)

House style to apply while porting. Derived from noesis `docs/decisions.md` +
SDLC `CLAUDE.md` (the good parts).

1. **Naming / structure:** kebab-case files; capabilities over technical layers;
   public-before-private function ordering; `assertNever` on every closed union
   (already in `shared-contracts/assert-never.ts` in both repos).
2. **Contracts are zod, consumed as TS source**, no build step (decision 3, 4).
   SDLC already uses zod for domain + skill schemas — good. SDLC's **UI contracts
   are plain TS `interface`s**; decide their fate in Part 8 (OQ-8.1).
3. **Tests are colocated `*.spec.ts`** run by `bun test` via a per-package Turbo
   `test` task (decided in Part 1). The SDLC BDD `given/when/then` authoring
   style is used **when applicable** (behaviour tests); pure schema-parse tests
   use plain assertions. **DB-touching specs share one in-memory database** via
   `apps/server/src/testing/test-db.ts` — `lbug` segfaults with many `Database`
   instances per process, and `bun test` runs all specs in one process (see
   Part 2). Never open a fresh `Database` per test.
4. **Generated artifacts are committed and CI-drift-checked** (decisions 6, 11).
   Any new model-facing schema/example follows the `turbo generate` pipeline.
5. **Route constants live in contract packages** (decision 18) — never hardcode a
   path in a controller or client.
6. **No `any` without justification; strict TS.** Note the bun tsconfig-`extends`
   decorator footgun (decision 7) — new Nest apps/packages need the two decorator
   flags inline.
7. **Persistence = DB only.** No artifact touches the filesystem on the server
   (see §2.2). Inputs arrive as REST content; outputs are DB rows.
8. **Everything is project-scoped.** Every artifact, query, and MCP call carries
   a project identity (Part 2, OQ-2.2); services never read or write across
   projects.

---

## Part 1 — Domain contract packages ✅ implemented

**Goal:** establish the zod domain model in `packages/` so every later part has
typed contracts to import. No behaviour.

**Decisions applied:**

- **OQ-1.1 → core domain in `shared-contracts`.** The core model (Conversation,
  Document, Topic, Decision, DesignDoc, InformationFragmentRef,
  InformationCategory, Project) lives in `@repo/shared-contracts`. Skill-output
  schemas live in `@repo/mcp-contracts` (model-facing payloads). UI page DTOs go
  in `@repo/ui-contracts` (Part 8). No new `domain-contracts` package.
- **OQ-1.2 → hybrid test layout.** Tests are colocated `*.spec.ts` next to the
  code, run by `bun test src` via a per-package Turbo `test` task (noesis's
  existing structure). The SDLC BDD `given/when/then` authoring style is kept
  **when applicable** — i.e. for behaviour tests; pure schema-parse tests use
  plain assertions. The `bdd.ts` helper is introduced with the first behaviour
  test (Part 3), in a shared test-helper location.

**What was built:**

- `@repo/shared-contracts/src/`: `assert-never.ts`, `uuid.ts`, `topic.ts`,
  `decision.ts`, `design-doc.ts`, `project.ts`, an `information-sources/` group
  (`information-category.ts`, `conversation.ts`, `document.ts`,
  `information-fragment.ts`), the barrel `index.ts`, and colocated specs. Ported
  from SDLC's `shared-contracts` to noesis style (single quotes, `.js` imports,
  zod 4). Per-field `<field>_locked` booleans are present everywhere
  (topic/decision/design-doc); there is no `edited_by_user`.
- **Information-source vocabulary (refactor of SDLC's names).** SDLC's
  conversation-biased names are generalized so topics/decisions reference source
  content source-agnostically: `IdeaUnit` → **`ConversationFragment`**,
  `SourceContentRef` → **`InformationFragmentRef`** (a union of
  `ConversationFragmentRef` | `DocumentFragmentRef`, both keyed by `…_id` +
  `fragment_index`), `IdeaUnitCategory` → **`InformationCategory`**, `SectionNode`
  → **`DocumentSection`**, `DocumentFile` → **`Document`**. The ref discriminators
  are `conversation_fragment_ref` / `document_fragment_ref`.
- **Documents are index-addressed, with no full-text blob.** `Document` holds
  `fragments` (each self-contained: `text` + `index` + `section_path` +
  `categories`) and a `section_tree` of `DocumentSection`; the SDLC `content`
  string and fragment `start_offset`/`end_offset` are **dropped** (fragments are
  the canonical representation). See Part 4.
- **Stored entities carry no workflow/staleness flags.** `Topic` and
  `Decision` have no `is_stale`, `reviewed`, or `decisions_extracted`;
  staleness is **computed at read time** (Part 5), and `reviewed` /
  `decisions_extracted` exist only on the skill-output `AnalyzedTopic`.
- `@repo/mcp-contracts/src/skills/analyzed-topic.ts` (+ spec): the
  `analyze-conversation` skill-output schema, built on the shared core model.
- `test` script (`bun test src`) + `@types/bun` added to both packages.

**Implementation notes (carried into later parts):**

- **`uuid.ts` is exposed via the subpath `@repo/shared-contracts/uuid`, not the
  barrel.** It uses Bun/node runtime APIs (`Bun.randomUUIDv7`, `crypto`), and
  the barrel is consumed by the browser-facing `ui-contracts`; keeping it out of
  the barrel keeps the shared barrel browser-safe. Server/skill code imports the
  subpath explicitly.
- **Source tracking is reframed off the filesystem** (§2.2). `source_sha` on the
  refs now means "SHA-256 of the referenced source content at ref-creation
  time" (DB-resident source content), not a file hash. SDLC's `source-files.ts`
  file-path/IO surface and `plugin-paths.ts` / `scopeDataDirToProject` are **not
  migrated**.
- **Project identity is a primitive, not yet wired into every artifact.**
  `project.ts` defines an opaque `ProjectId` + `Project`. How a project is
  identified and how `project_id` is attached to each artifact/query is finalized
  in Part 2 (OQ-2.2), so the artifact schemas were left unscoped for now to avoid
  pre-empting that decision.

**Verified:** `turbo check-types` green across all 8 packages; `turbo test` green
(22 contract specs); prettier clean.

---

## Part 2 — Database layer (LadybugDB) + multi-tenancy ✅ implemented

**Goal:** stand up the graph DB in `apps/server` — on-disk, project-scoped, and
ready for concurrent multi-user access.

**Decisions applied:**

- **OQ-2.1 → centralized schema.** All DDL lives in one declarative
  `src/schema/graph-schema.ts` (`GRAPH_SCHEMA`), run once at startup by
  `SchemaService` (idempotent `IF NOT EXISTS`). Each later part appends its node/
  rel tables there instead of scattering `CREATE … TABLE` across repositories;
  the schema-explorer reads it via `SchemaService.statements()`.
- **OQ-2.2 → server-minted project id.** A `Project` is created on the server,
  which mints its id as a **UUIDv7**; all clients receive and reuse it. Rows are
  scoped by `project_id` at the DB layer, resolved from the authenticated caller
  — so `project_id` is **not** part of the skill-produced artifact contracts
  (the artifact schemas stay unscoped; scoping is added to each node table as
  artifacts land in Parts 3–6). `ProjectIdSchema` stays an opaque non-empty
  string (the server owns the format).
- **OQ-2.3 → lbug transactions + optimistic concurrency.** Every mutable row
  carries a `version`; mutations match on the expected version and increment it,
  surfacing a `ConcurrencyConflictError` on mismatch (reference implementation:
  `ProjectsRepository.rename`). No backups for now. Schema changes are explicit
  migrations (the DB is authoritative; no rebuild-from-files).

**What was built (`apps/server/src/`):**

- `config/config.module.ts` — `@Global` zod-validated config (decision 10);
  provides the `DATA_DIR` token from `NOESIS_DATA_DIR` (default `.data`),
  fail-fast on invalid. SDLC's `PROJECT_DIR` is gone (one server data dir).
- `database/database.service.ts` (+ `.module`, lifecycle `.spec`) — the `lbug`
  wrapper, ported. Creates the data dir if missing, supports `:memory:`.
  `lbug` added to deps + `trustedDependencies`.
- `database/concurrency.ts` — `ConcurrencyConflictError`.
- `schema/{graph-schema.ts,schema.service.ts,schema.module.ts}` (+ `.spec`) —
  the centralized schema and its startup runner. Currently declares the
  `Project` node table.
- `projects/{projects.repository.ts,projects.service.ts,projects.module.ts}`
  (+ `.spec`) — the Project entity: `create` (mints UUIDv7), `findById`, and the
  optimistic-concurrency `rename`. Wired into `AppModule`.

**Implementation note — lbug multi-instance segfault (affects all DB tests):**
the bundled `lbug` build **segfaults once more than ~4 `Database` instances are
opened in one OS process** (a kuzu global-state limitation), and `bun test` loads
every spec into one process. So DB-touching specs **share one in-memory database**
via `src/testing/test-db.ts` (`sharedTestDatabase()` + `resetGraph()`); only the
`DatabaseService` lifecycle spec stands up its own (minimal) instances, and all
e2e specs that boot `AppModule` use a single app pointed at `:memory:`. This is
the standing test convention for every later part that adds repositories — add
repo specs against the shared fixture, never a fresh `Database` per test.

**Verified:** `turbo check-types`, `turbo lint`, `turbo test` (unit) and
`turbo test:e2e` all green; server boots on-disk and in-memory; prettier clean.

---

## Part 3 — Knowledge: Conversations

**Goal:** first vertical slice end-to-end, establishing the **service / repository
/ MCP-tool / REST-controller / UI-controller** pattern that Parts 4–6 copy.

**What moves:** `knowledge/conversations/*` (service, repository, mcp, controller,
`idea-unit-relevance`, plus the `scripts/conversation/*` prepare/segment helpers,
which run on the developer machine before the skill).

**Adjustments / SDLC changes needed (these recur in Parts 4–6):**

- **MCP→service boundary is now MCP→REST→service across machines.** In SDLC the
  MCP tool handler called `ConversationsService` in-process. Now the tool lives in
  `apps/local`, calls the **remote** server's `/api/*` endpoint via
  `ServerClientService`, and the server runs the service. **This is the single
  biggest mechanical change in the migration** and touches every MCP tool.
- **Content over REST, not paths.** The skill writes `output.json` + cleaned
  `<id>.md` to a local working dir; `apps/local` **reads those files and sends
  their content** in the REST body. The server never sees the developer's
  filesystem. (This is forced by the network boundary — there is no shared FS.)
- Adopt NEW-DESIGN: `ConversationsService` orchestrates, `ConversationsRepository`
  does **DB I/O only** (no file I/O — §2.2); the service validates (private
  method), splits the conversation into turns and **`ConversationFragment`s**, and
  saves via owning repositories (cross-domain repo access is allowed and expected).
- **Remove `validate_output` as a separate MCP tool** (NEW-DESIGN): validation =
  loading the request body through the zod schema at the merge endpoint.
- Drop the legacy `ConfirmedEditSchema` / `confirmed_edits[]` per-field model;
  replace with a single `confirmed_by_user: boolean` merge argument.
- All endpoints/queries carry the caller's `project_id` (OQ-2.2).

### OQ-3.1 — REST contract granularity for MCP-facing endpoints

Each MCP tool needs a matching `/api/*` endpoint. Decide the contract style:

- **Option 1 — one REST endpoint per MCP tool** (`POST /api/conversations/merge`,
  `GET /api/conversations/:id/exists`, …), request/response zod in
  `local-contracts`. Explicit, easy to auth/version per operation.
- **Option 2 — a thin generic "invoke" endpoint** that proxies tool name +
  payload. Less boilerplate, but loses per-operation typing and the
  route-constant drift-protection of decision 18.

_Best practice:_ explicit typed endpoints (Option 1) match decision 18 and keep
the `/api` surface auditable. **Recommend Option 1.** **Confirm** (this sets the
pattern for all tools).

**Review checklist:** one full vertical (prepare → skill output → `local` sends
content → server merges → DB rows written → UI reads it) works; pattern
documented for reuse; no `validate_output` tool; `confirmed_by_user` in place;
everything project-scoped.

---

## Part 4 — Knowledge: Documents

**Goal:** second knowledge vertical; introduces multi-target splitting and
decision-attachment appends.

**What moves:** `knowledge/documents/*` (+ `enriched-topic`, `node-ids`) and
`scripts/document/*` (markdown fragmenting, decision-coverage check; run on the
developer machine).

**Adjustments / SDLC changes needed:**

- `DocumentsService` is the **single orchestrator** for `analyze-design-draft`
  output — it also writes the extracted design-doc (via `DesignDocsRepository`)
  and appends `decision_attachments` to existing decisions' `supporting_info`
  (unconditional, de-duplicated, no lock). There is **no** separate
  `save_design_doc` agent call. Ensure Part 6 (DesignDocs) exposes the repository
  save path Documents needs.
- All writes go to the **DB** via owning repositories (no file I/O).
- **Index-addressed document model (no full-text blob).** Per the Part 1
  contracts, a `Document` is `fragments` (each self-contained: `text` + `index` +
  `section_path` + `categories`) plus a `section_tree` of `DocumentSection`. The
  SDLC `content` string and fragment byte `start_offset`/`end_offset` are gone, so
  the markdown fragmenter is adapted to emit indexed fragments (no offsets), and
  `DocumentFragmentRef`s address fragments by `document_id` + `fragment_index`.
- Same MCP→REST re-plumbing, content-over-REST, and `validate_output` removal as
  Part 3.

_No new OQ_ — follows OQ-3.1. Flag if the cross-domain write (Documents writing
design-docs) tempts a shortcut that violates "each kind saved by its own
repository."

**Review checklist:** design-draft analysis produces document + topics + decisions
(+ optional design-doc) all written by their owning repositories to the DB;
attachments append idempotently.

---

## Part 5 — Knowledge: Topics & Decisions (staleness + locking)

**Goal:** the manual-edit + staleness machinery, shared by both kinds.

**What moves:** `knowledge/topics/*`, `knowledge/decisions/*`, and the
`InformationFragmentRef.source_sha` logic underpinning staleness.

**Adjustments / SDLC changes needed:**

- Adopt **per-field locks** on editable fields (topics: title/short/long summary;
  decisions: title/status/context/decision text+rationale/alternatives) and drop
  any `edited_by_user`.
- **Staleness is computed at read, not stored.** `Topic` / `Decision`
  hold no `is_stale` field (nor `reviewed` / `decisions_extracted`). A derived
  item is stale when any of its `InformationFragmentRef.source_sha` values differs
  from the current source-content hash in the DB; the service computes this on
  read and the UI renders it. There is no watcher and no persisted flag to keep
  coherent. (`reviewed` / `decisions_extracted` live only on the skill-output
  `AnalyzedTopic`, where the model proposes them.)
- Lock semantics: a `<field>_locked` is set true only when a user edit actually
  changes the value; `confirmed_by_user=true` bypasses locks for that call;
  system-managed fields (`supporting_info`, `source_sha`, ids) are never
  locked.

### OQ-5.1 — Manual create/delete/reparent scope

NEW-DESIGN **defers** manual topic/decision creation & deletion, topic
reparenting, and add/remove alternative options — today only field edits exist.

- **Option 1:** match NEW-DESIGN — field edits only; defer the rest.
- **Option 2:** since "clean from the start," design create/delete/reparent now
  even if the UI doesn't expose them yet.

_Best practice:_ build the model for known-coming operations but don't ship
unused write paths (YAGNI vs. design-for-change). **Recommend Option 1** (defer)
unless these are imminent. **Your call on scope.**

**Review checklist:** edit → lock set only on real change; `confirmed_by_user`
bypass works; staleness is derived at read from `source_sha` vs current
source-content hash (nothing persisted).

---

## Part 6 — Knowledge: Design Docs (nested model)

**Goal:** the most complex contract — the nested DDD tree with locks at every
level, actors, and the "implemented" terminal state.

**What moves:** `knowledge/design-docs/*` (service, repository, `merge`), the
`design-doc.ts` contract (already has the lock scaffolding), and the
graph-projection logic.

**Adjustments / SDLC changes needed:**

- Locks at **every** editable name/description across DesignDoc → BoundedContext →
  Module → BuildingBlock → Behaviour → Rule → Scenario → QualityAttribute →
  Property → Actor.
- **Actors are part of the design-doc record** (no separate global catalog / no
  `upsert_actor` write path), **graph-global by name** at projection time (dedupe
  on shared node, last-write-wins on description).
- **Canonical naming** (`slug≤20 + id-suffix`) computed by `DesignDocsService`
  and stored on the **DB record**; the repository updates the record on rename.
  (SDLC's "remove the previous file on rename" is moot — there are no files.)
- **"Implemented" lock:** transition triggered by `implement-design-doc` (not a UI
  action); once implemented, both `create-design-doc` and UI write paths must
  reject edits.
- Mind the **"diff" terminology** rule (NEW-DESIGN): a DesignDoc _is_ a diff
  (added/modified/removed `ChangeSet`) between current and designed model —
  distinct from a version-to-version diff. Do not conflate in code or naming.

### OQ-6.1 — `ChangeSet<T>` representation in the graph projection

The `{added, modified, removed}` ChangeSet at every nesting level is rich on the
record but must project to graph nodes/edges for the model-explorer. Decide the
projection semantics:

- **Option 1:** project the **resulting designed model** (apply the changeset) as
  nodes, keeping `added/modified/removed` as node attributes for rendering.
- **Option 2:** project the **diff itself** as first-class (nodes tagged by change
  kind) — matches "a design doc is a diff."

_This is a domain-modelling choice with no obvious default_ — it depends on what
the model-explorer is _for_ (showing the target architecture vs. showing what a
doc changes). **Needs your decision**; I will not invent it.

**Review checklist:** round-trips a 3-level doc with locks; rename updates the
record; implemented docs reject writes from both paths; actors dedupe by name.

---

## Part 7 — MCP tool surface & REST API wiring

**Goal:** consolidate the `apps/local` MCP registration and the `apps/server`
`/api` surface; retire SDLC's monolithic `server.ts` registration block.

**What moves:** all `*.mcp.ts` registration files (conceptually), the
`mcp-tool-output.ts` formatting helpers, and the `ServerClientService` REST
client (extend noesis's existing one).

**Adjustments / SDLC changes needed:**

- SDLC's `server.ts` registers every tool against an in-process service. Replace
  with: tools in `apps/local/src/mcp.ts` (+ a module per domain) →
  `ServerClientService` methods → `/api/*` endpoints on the **remote**
  `apps/server` (per OQ-3.1).
- **`ServerClientService` is now a real network client:** base URL of the remote
  server from config, auth token attached, project identity resolved and attached
  per call (OQ-2.2), error/retry handling for a remote endpoint.
- **Auth becomes real** (multi-user, §2.5): `local`→`/api` uses an API token; the
  UI→`/ui` uses a session (decision 18). Each `local` instance authenticates and
  is bound to its project.
- Port `mcp-tool-output.ts` (file-output vs inline-JSON tool results, stale-output
  pruning) — its temp dir lives where the MCP process runs (`local`, on the
  developer machine).
- Bundle implications (decisions 9, 15): the `local` MCP server is bundled into
  `plugins/claude-code/servers/noesis-local.js`. Because `local` is now a thin
  REST client, the bundle stays small — **verify `lbug` native bindings are NOT
  dragged into `local`** (they belong only to the server) and that the bundle
  still boots from an empty dir (decision 9's invariant).

### OQ-7.1 — MCP tool output: file vs inline

SDLC returns large tool outputs as files (`runFileOutputTool`) vs small ones
inline (`runInlineJsonTool`). Keep this dual mode? It interacts with the
model-facing contract story (`prepare-mcp-data` skill + generated JSON Schemas).
**Recommend** keeping it (large graph payloads shouldn't go inline) but **confirm**
the threshold/policy.

### OQ-7.2 — Reconciling `validate_output` removal with the plugin's contract machinery

noesis's plugin ships a `prepare-mcp-data` skill + generated `*.schema.json` +
`scripts/validate.ts` so the _model_ can self-validate payloads before calling a
tool (decisions 6, 13, 14). NEW-DESIGN removes the server-side `validate_output`
tool (validation = zod load at merge). These aren't contradictory (one is
model-side pre-flight, the other server-side enforcement), but decide:

- Keep **both** (model pre-validates via generated schema; server re-validates via
  zod at the merge endpoint — defense in depth), or
- Drop the model-facing machinery and rely solely on server-side zod (simpler,
  but the model gets worse error-shaping before the call).

_Best practice:_ schema at the boundary you control + helpful pre-flight for the
model is the robust combination; generating model-facing schemas from the same
zod source is decision 13's value. **Recommend keep both.** **Confirm.**

**Review checklist:** every former in-process tool now goes MCP→REST→service over
the network; auth + project identity attached per call; bundle boots from empty
dir; `lbug` not in the `local` bundle; output formatting preserved.

---

## Part 8 — UI app

**Goal:** migrate the React/Vite UI into `apps/ui`, pointing at the remote
server's `/ui` surface, for multiple concurrent users.

**What moves:** `mcp/noesis-graph/ui/src/*` — pages (conversations, documents,
topics, decisions, design-docs, model-explorer, schema-explorer), shared
components, theme; plus the `ui-contracts/*` DTOs.

**Adjustments / SDLC changes needed:**

- Repoint API calls from SDLC's `/api/ui/*` to noesis's **`/ui/*`** surface
  (decision 18) using `uiRoutes`/`uiPath` constants — no hardcoded paths.
- **No port discovery.** SDLC's `dev-discovery.ts` (random local server port) is
  removed; the server is a fixed remote URL. The Vite dev proxy targets the
  configured server URL.
- **Multi-user UI:** the UI authenticates (session per decision 18) and operates
  within a selected project (OQ-2.2). Account for project selection/scoping in the
  UI shell and for concurrent edits surfacing (e.g. staleness/lock state changing
  underneath a user).
- Remove `edited_by_user` from UI contracts; render the per-field lock model
  (`<field>_locked`) and **derived** staleness (computed server-side from
  `source_sha`, returned on the read DTO — not a stored `is_stale` field).

### OQ-8.1 — UI contract form: keep plain TS interfaces, or make them zod

SDLC's `ui-contracts/*` are hand-written TS `interface`s, **not** zod — diverging
from decision 4.

- **Option 1:** convert UI contracts to zod in `@repo/ui-contracts` (uniform;
  enables runtime validation of API responses; single source of truth).
- **Option 2:** keep them as TS interfaces (read-only projections; runtime
  validation may be unnecessary overhead).

_Best practice:_ decision 4 committed to zod-everywhere; deriving UI DTO types
from zod keeps server/UI in lockstep, with runtime validation opt-in at the fetch
boundary. **Recommend Option 1.** **Confirm.**

### OQ-8.2 — Mantine + `@xyflow/react` dependency adoption

The UI depends on Mantine 9 and `@xyflow/react` 12 (graph views). `apps/ui` is
currently a bare Vite app. Confirm these are adopted as-is (vs. re-evaluating the
libraries for the clean start). **Recommend** adopt as-is (proven here;
re-selection is a separate project). **Confirm.**

**Review checklist:** each page renders against the remote `/ui` surface;
auth/project selection works; lock/staleness badges reflect the new model; no
`edited_by_user`; graph views (model/schema explorer) work.

---

## Part 9 — Scanner, invocations & implementation-check (deferred track)

**Goal:** the code-analysis subsystem feeding `implement-design-doc`.

**What moves:** `scanner/*` (C# analysis, DDD annotations, invocation graph),
`scanner/invocations/*`, `implementation-check/*`.

**Important context:** NEW-DESIGN puts this subsystem **out of scope** of the
clean refactor ("stays as-is"), so it is the **least clean** code. It also
collides with noesis decisions 19/20, which describe scanners as
**out-of-process** engines that ship graph facts (Java = ArchUnit + Spoon), with
`scanners/dotnet` as a planned sibling. The new topology makes the out-of-process
shape natural: the developer's code lives on the developer machine, so the
scanner runs there and **ships graph facts to the remote server**, which stores
them and runs implementation-check.

### OQ-9.1 — In-process TS C# scanner vs. out-of-process `scanners/dotnet`

SDLC's scanner is **TypeScript, in-process**, inside the Nest app. noesis
decisions 19/20 mandate out-of-process scanners that emit a typed graph contract
— and the remote-server topology forbids the in-process shape anyway (the server
cannot see the developer's code).

- **Option 1:** keep a TS C# scanner but run it **locally, out-of-process** (on
  the developer machine), shipping facts to the server. Faster to migrate than a
  rewrite; still architecturally consistent with the topology, though
  lower-fidelity than Roslyn.
- **Option 2:** rebuild C# scanning as `scanners/dotnet` (Roslyn analogue of
  ArchUnit/Spoon), emitting the same graph-facts contract as the Java scanner.
  Larger effort; architecturally correct.
- **Option 3:** defer the scanner/implementation-check subsystem entirely;
  migrate the knowledge core first.

_Best practice:_ the clean-from-the-start mandate is hard to reconcile with the
explicitly-not-clean scanner. **Recommend Option 3 (defer)**, and when picked up,
**Option 2** (Roslyn, aligned with decisions 19/20, shipping facts to the
server). **Decide scope + approach.**

### OQ-9.2 — Implementation-check coupling

`implementation-check` compares a design doc (in the server DB) to scanned code
facts (shipped from the developer machine); it depends on whatever OQ-9.1
produces. It follows the scanner decision (defer with it, or rebuild against the
out-of-process facts contract). **Tie to OQ-9.1.**

**Review checklist (if not deferred):** scanner runs locally and ships the typed
graph-facts contract to the server; implementation-check consumes it server-side;
subsystem isolated from the knowledge core.

---

## Part 10 — Skills

**Goal:** migrate the Claude Code skills into `plugins/claude-code/skills/`.

**What moves:** `skills/{analyze-conversation,analyze-design-draft,create-design-doc,
implement-design-doc,search-topics,clarify-requirements}/` (SKILL.md + references).

**Adjustments / SDLC changes needed:**

- Skills must align with the new MCP tool names/payloads (Parts 3–7) and the
  `output.json`-to-content handoff (skills write output locally; `local` sends
  content to the server). Any SKILL.md referencing `validate_output` or
  `save_design_doc` must be updated (those tools are gone).
- Generated references: noesis generates `references/*.schema.json` +
  `*.example.json` from `mcp-contracts` (decisions 6, 13) and commits them (CI
  drift-checked). SDLC's skill references are hand-written prose — keep the prose,
  **add** the generated schema/example artifacts via `turbo generate`.
- Skill outputs are validated by zod load at the server merge endpoint (no
  separate tool).

### OQ-10.1 — Skill scope for the first migration milestone

`implement-design-doc` (16 references) and `clarify-requirements` depend on the
scanner subsystem / are heavier. If Part 9 is deferred (OQ-9.1),
`implement-design-doc` should defer with it.

- **Recommend:** migrate `analyze-conversation`, `analyze-design-draft`,
  `create-design-doc`, `search-topics` first; defer `implement-design-doc`
  (+ `clarify-requirements`) with the scanner. **Confirm scope.**

**Review checklist:** migrated skills reference only existing tools; generated
references committed + drift-checked; `analyze → create-design-doc` chain works.

---

## Part 11 — Tests, dev-seed & smoke

**Goal:** test coverage + comprehensive seed fixtures + the end-to-end smoke test.

**What moves:** the BDD/test discipline (per Part 1's hybrid layout),
`dev/dev-seed.ts` (with its
exhaustive optional/ChangeSet/union coverage rules), and the `test:smoke` harness
(real `claude -p` through the skill chain).

**Adjustments / SDLC changes needed:**

- Dev-seed coverage rules (every optional/nullable field has null+populated
  fixtures; every ChangeSet slot exercised; every union variant present) are
  excellent — **keep them** and apply transitively to the new contracts. Seed
  data is now written to the **server DB** (project-scoped), not to files.
- Per noesis (decision 21), tests run under `turbo test` / `--affected`; the smoke
  test consumes tokens and must stay **opt-in** (env-gated, never autonomous) —
  preserve SDLC's `NOESIS_SMOKE_CONFIRM` guard.
- The smoke test now drives the full distributed path (`local` → remote `server`)
  — point it at a test server instance and a throwaway project.

### OQ-11.1 — Smoke test in CI

SDLC's smoke test drives a real LLM session (costs tokens). Decide whether it runs
in CI at all (manual-only vs. nightly-scheduled vs. never-in-CI). **Recommend**
manual/opt-in only (matches SDLC). **Confirm.**

**Review checklist:** seed exercises every contract shape; unit tests green under
Turbo; smoke test gated and documented.

---

## 4. Consolidated open-questions index

The foundational architecture (§2) is decided; Parts 1 and 2 are implemented.
Remaining OQs:

| OQ      | Part | Question                                                    | Blocks                    |
| ------- | ---- | ----------------------------------------------------------- | ------------------------- |
| OQ-3.1  | 3    | REST contract granularity per MCP tool                      | 4,5,6,7                   |
| OQ-5.1  | 5    | Manual create/delete/reparent scope (defer?)                | 8                         |
| OQ-6.1  | 6    | ChangeSet graph projection: designed model vs diff-as-nodes | 8 (model-explorer)        |
| OQ-7.1  | 7    | MCP tool output: file vs inline policy                      | 10                        |
| OQ-7.2  | 7    | Keep model-facing validate machinery + server-side zod?     | 10                        |
| OQ-8.1  | 8    | UI contracts: zod vs plain TS interfaces                    | —                         |
| OQ-8.2  | 8    | Adopt Mantine + `@xyflow/react` as-is?                      | —                         |
| OQ-9.1  | 9    | C# scanner: out-of-process TS vs `scanners/dotnet` vs defer | 10 (implement-design-doc) |
| OQ-9.2  | 9    | Implementation-check coupling (tie to 9.1)                  | —                         |
| OQ-10.1 | 10   | First-milestone skill scope (defer implement-design-doc?)   | —                         |
| OQ-11.1 | 11   | Smoke test in CI (manual/nightly/never)                     | —                         |

## 5. Recommended sequencing

```
Part 1  (contracts)   ✅ implemented
  └─ Part 2  (database + multi-tenancy)   ✅ implemented
       └─ Part 3  (conversations)   ← next; establishes the vertical pattern
            ├─ Part 4  (documents)
            ├─ Part 5  (topics + decisions, staleness at ingest)
            └─ Part 6  (design-docs)
                 └─ Part 7  (MCP/REST wiring consolidation, auth)
                      └─ Part 8  (UI)
Deferred track (after the knowledge core is solid):
  Part 9 (scanner / impl-check)  →  Part 10's implement-design-doc
Cross-cutting, grows with every part:
  Part 10 (skills, the in-scope ones)   Part 11 (tests, seed, smoke)
```

**Net recommendation:** port the **knowledge core** (Parts 1–8) against the
NEW-DESIGN model on the decided architecture (server-owned authoritative DB, thin
`local` adapter, no indexer), and **defer the scanner / implement-design-doc
subsystem** (Part 9 + its skill) — it is the un-clean, architecturally divergent
corner and fits the "clean from the start" mandate poorly until rebuilt to
decisions 19/20.

## 6. SDLC-side changes summary (where the source repo must change)

The concrete "SDLC's current code cannot be copied verbatim" cases, collected.
Most are _conceptual_ — applied while porting:

1. **MCP→service boundary** (Parts 3–7): every in-process tool→service call
   becomes MCP(`local`) → **network** REST(`/api`) → service(`server`).
   _Biggest change._
2. **Content over REST, not paths** (Parts 3, 4): `local` reads the skill's local
   `output.json` and sends content in the REST body; the server never touches the
   developer FS.
3. **DB is the source of truth; no file I/O** (Parts 3–6): repositories persist to
   LadybugDB only; SDLC's "repository does DB + source-file I/O" collapses to DB
   I/O.
4. **Indexer / file watcher removed** (was SDLC `indexer/*`): staleness recompute
   moves into the owning service at ingest time (Part 5).
5. **Single-process `server.ts` decomposed** (Part 7): the combined NestJS-HTTP +
   stdio-MCP + DB + browser-open bootstrap splits into the app boundaries.
6. **`validate_output` / `save_design_doc` tools removed** (Parts 3, 4, 6, 10):
   validation = zod load at the merge endpoint; design-doc save folded into
   `DocumentsService`.
7. **`confirmed_edits[]` → `confirmed_by_user: boolean`** (Parts 3–6).
8. **`edited_by_user` removed → per-field `<field>_locked`** (Parts 1, 5, 6, 8).
9. **Source addressing reframed** (Parts 1, 4, 5): SDLC's `IdeaUnit` /
   `SourceContentRef` / `IdeaUnitCategory` / `SectionNode` → `ConversationFragment`
   / `InformationFragmentRef` / `InformationCategory` / `DocumentSection`;
   on-disk-file SHA → `source_sha` over DB-resident source content; documents are
   index-addressed (no `content` blob, no byte offsets); stored entities carry no
   `is_stale` / `reviewed` / `decisions_extracted` (staleness is computed at
   read).
10. **Project scoping added** (Parts 1, 2): `NOESIS_PROJECT_DIR` per-launch
    identity → a stable `project_id` scoping all rows; multi-tenant server.
11. **DB config** from CLI-arg/env (`DATA_DIR`/`PROJECT_DIR`) → zod-validated
    `ConfigModule`; single server data dir, project scoping inside the DB (Part 2).
12. **UI contracts → zod**, repointed from `/api/ui/*` to `/ui/*`, port discovery
    removed, auth + project selection added (Part 8).
13. **Scanner** rebuilt out-of-process (runs locally, ships facts to the server)
    to match decisions 19/20 (Part 9).
14. **Skill references** gain generated `*.schema.json`/`*.example.json` artifacts
    from `mcp-contracts` (Part 10).
15. **Never migrate** `noesis-backup/`, the legacy non-`New` services, or the
    `*New` shadow naming — port the NEW-DESIGN _model_, written cleanly once.
