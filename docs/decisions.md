# Architecture Decisions — current

The ten decisions in force, D1–D10. Everything here describes the tree as it
is; if this file and the code disagree, that is a bug in one of them — say so
rather than picking one silently.

_Last updated: 2026-09-21, checked against the code on that date._

**How to use this file**

- This is the only decision record to read. The superseded history is frozen in
  `docs/archive/`; agents do not read it (reads there are denied in
  `.claude/settings.json`) unless a person asks for the history.
- Cite decisions as `D<n>` (`decision D3`).
- **Changing a decision:** edit the D-entry in place so it states the new
  truth, bump the date above, and move the displaced text to the archive under
  a new dated heading. Never leave a superseded statement in this file. A
  genuinely new theme becomes D11, D12, …; keep the file small enough to read
  whole.

---

## D1. Architecture: files under `.noesis/` are the truth; one local stdio service per agent session

- **The files in the user's repository are the source of truth; the graph is a
  cache.** Knowledge lives as JSON under `.noesis/` (layout in D2) and is
  committed to git, so it branches, diffs and gets reviewed like code. The
  embedded graph database is in-memory, rebuilt from the files at boot, kept
  current by a watcher (including changes Noesis did not make: a checkout, a
  branch switch, a hand edit), and is never authoritative. There is nothing on
  disk to recover.
- **One Noesis service process per agent session, started by the agent host
  over stdio.** The same process holds the MCP endpoint for the agent, the HTTP
  API and SPA for the browser (ephemeral port, default browser opened once at
  boot, URL also logged to stderr), the services, the file store, the graph
  cache, the watcher and the TypeScript scanner. Both entry points land on the
  same service layer. There is no daemon, no browser-only mode, no server
  component and no network beyond loopback: the UI lives as long as the agent
  session.
- **Local, single-user, single-checkout.** One user, one writer, one
  repository: nothing is guarded and nothing is scoped by account or project.
  The service serves the checkout it was started in; a second repository means
  a second process. Making it reachable by anyone else is a new
  decision that would have to introduce a trust boundary from scratch.
- **Nothing is hosted or deployed.** What ships is two npm packages (D6).
- **No LLM in the service.** Semantic work happens in the agent driving a
  skill; the service is deterministic data access and validation.
- **Source code never leaves the machine.** Scanning reads the local working
  copy (D9).
- Two agent sessions on one checkout are two processes over the same
  `.noesis/`; see D2 for the concurrency rule.

Rejected: a graph-authoritative store with file export (hand edits and branch
switches could not flow back); a separate MCP bridge process talking REST to the
service; a user-started long-running HTTP daemon; a stdio launcher attaching to
a shared process. The target design is `docs/arch/ARCHITECTURE.md`.

## D2. `.noesis/` layout and `NoesisStore`

- **`.noesis/graph/` holds the knowledge graph and nothing else.** One directory
  per object at every depth, named by the object's key, holding exactly one
  `data.json` plus the object's child collections:
  `changes/<slug>/data.json`, `changes/<slug>/{conversations,documents,design-docs}/<id>/data.json`,
  `system-model/<id>/data.json`, `wiki/topics/<id>/data.json`,
  `wiki/decisions/<id>/data.json`. Only files the store writes may exist there.
- **A directory without `data.json` is not an object**: `keys()` skips it, `get`
  returns `null`, and a sweep at boot removes it recursively before indexing.
- **Unversioned siblings of `graph/`:** `tmp/<session-id>/` (scratch between
  agent and service; created at boot, deleted on clean shutdown, leftovers older
  than seven days swept), `logs/` (D10) and `sources/` (drop zone for
  transcripts, Markdown, PDFs a skill reads; the service neither reads nor
  indexes it). `NoesisDir.ensureInitialized()` creates them and maintains
  `.noesis/.gitignore`. Everything under `graph/` is committed.
- **`NoesisStore` is the only write path** (`server/backend/src/platform/files/`). A
  collection is a directory, a zod schema and named child collections; a handle
  offers `get`, `set`, `delete`, `keys`, `children`, with types inferred from
  the definitions. `set` validates, serialises the parsed value, writes a temp
  file in the object's directory and renames it over `data.json`. The key is
  the repository's choice (the slug for a change, the contract id elsewhere).
  No `getAll`, no sorted listing, no metadata on reads: services read the
  in-memory graph, repositories only modify files, the indexer walks `keys()` +
  `get`.
- **Concurrency is last write wins over atomic whole-file writes.** No locks, no
  coordinator, no hash preconditions. A lost update within the same seconds is
  accepted for a single user and shows in `git diff`.
- **Ids.** A document is keyed by its title as a slug, unique within its
  change: the title is the identity, the content is free to be revised, and a
  retitle moves the object. Entities the graph authors get a time-ordered id
  the service mints; a scanned system model hashes its name. A reference is
  the target's id.
- **Changes.** A change is `graph/changes/<slug>/`; its `data.json` carries
  `slug`, `name`, `key`, `type`, `status`, `created_at`, `description`. The
  service derives the slug from the name, starts status at `discovery`, refuses
  a taken slug or key with a 409 naming the field, and lists newest first. The
  `key` is the team's tracker key: entered, optional, unique — never generated.
- **Repository root:** `NOESIS_ROOT` (the plugin sets it to
  `${CLAUDE_PROJECT_DIR}`), else the nearest `.git` walking up from the working
  directory; the service refuses to start without one.
- **Boot re-index cost** is accepted and measured (`bun run test:bench`, 1k and
  10k files; working budget 2 s at 10k). An on-disk cache is a follow-up only if
  that budget is exceeded.

File conventions for skills: the contracts' `.describe()` text (D4).

## D3. Service internals: Hono on `Bun.serve`, surfaces by consumer, thin MCP tools, validation at the write boundary

- **`server/backend` is a Hono app on `Bun.serve` with an explicit composition
  root** (`main.ts` constructs services, wires `createApp(deps)`, owns
  lifecycle). Surfaces are factory functions taking narrow deps interfaces.
- **Layers under `src/`, enforced by Oxlint** (`bun run lint`, through
  eslint-plugin-boundaries and `import/no-cycle`; rules in the root
  `.oxlintrc.json`): `platform` (files, database, logging, crypto) imports
  no other layer; `app` is the core — the domain model (the contracts in
  `app/<feature>/model/`, D4), services, the file contracts, and the
  ports they need (`ChangesRepository`, `DesignDocsRepository`,
  `SearchProvider`) — and imports no other layer, zod being a dependency
  of `app` by design; the `model/` folders are their own lint element and
  import only zod and each other;
  `adapters` implement those ports over `platform` (`store/` over
  `NoesisStore`, `graph/` over LadybugDB) or drive `app` (`mcp/`,
  `scanner/`); `ui` drives `app`. `adapters` and `ui` never import each other,
  no layer imports the composition root (`src/*.ts`), and there are no
  cycles.
- **Imports are extensionless; across directories they use `#backend/*`**
  (`#backend/app/changes/changes.service`, tests too), relative only within a
  directory. The alias is a tsconfig `paths` entry mapping to `src/*`, and the
  frontend maps the same name to the same files, so backend source resolves
  alike in both programs. Consumers import a contract file directly
  (`#backend/app/changes/model/change`); there is no contracts barrel.
  Contracts keep relative imports among themselves: the plugin ships them
  as a standalone copy (D4).
- **Routes are segregated by consumer:** `/ui/*` (the SPA) and `/internal/*`
  (health and technical endpoints). The agent does not use HTTP — it reaches the
  same services over MCP on stdio. Surface routes win over the SPA's `/*` route, so a surface 404 is
  never swallowed by the page. stdout belongs to the MCP transport; everything
  else writes to stderr. The `console.log` redirect lives in `stdout-guard.ts`,
  `main.ts`'s first import, because imports are hoisted and an assignment in
  `main.ts` would run after every dependency's import-time logging; Bun's
  browser-console echo is on only when stdin is a terminal.
- **Keep the `.route()` chains unbroken** in `app.ts` and `ui.routes.ts`: Hono
  infers the route tree from the expression, and the frontend's typed client
  depends on it (D5).
- **The MCP surface is the v2 SDK's `McpServer`.** v2 is the split-package
  release line — `@modelcontextprotocol/server` (and
  `@modelcontextprotocol/client` for the tests); the monolithic
  `@modelcontextprotocol/sdk` stopped at 1.30.0 and is not a dependency.
  `adapters/mcp/mcp-server.ts` composes the server and one module per tool
  under `adapters/mcp/tools/` registers itself. A tool declares a title, a
  description, a zod `inputSchema` and a zod `outputSchema` — the domain
  contract itself wherever one fits — and its behavioural annotations, and
  answers with `structuredContent` that the SDK checks against that output
  schema. Tool names are snake_case. Current tools: `create_change`,
  `list_changes`, `add_document_to_change`; the surface was rebuilt down to
  two and grows back one tool at a time. A listing tool takes no arguments,
  is annotated read-only, and repeats the slugs in its text for hosts that
  read only that. Every handler is registered through
  `logged()` (`adapters/mcp/tool-handler.ts`): the SDK answers a thrown error
  in-band by itself but silently, so an unforeseen failure would otherwise
  leave nothing in `.noesis/logs/` for the person whose session broke.
  `logged()` hands the SDK's `ServerContext` on, so a tool can reach the
  cancellation signal without the wrapper changing. Outside a tool call,
  `uncaughtException` and `unhandledRejection` are logged as fatal and end the
  session through `shutdown(1)`, so the log says why and the database still
  closes. The
  declared capability is `tools: { listChanged: false }`, which is the truth —
  the list is fixed for the connection's life and no notification ever
  follows; the SDK advertises `true` for a server that says nothing.
- **stdio is served by `serveStdio(factory)`** from
  `@modelcontextprotocol/server/stdio`, not by connecting a
  `StdioServerTransport` by hand: only that entry serves the **2026-07-28**
  revision, and it serves the 2025 era from the same factory for hosts that
  have not adopted it. The opening exchange picks the era and pins one server
  instance to the connection. `test/e2e/mcp.e2e.spec.ts` exercises both eras
  against the real process, because a linked `InMemoryTransport` pair — what
  the unit spec uses — reaches the 2025 era only.
- **`instructions` carry nothing process-specific.** On a modern stdio
  connection the SDK probes the protocol era with a **throwaway sibling
  process** spawned from the same command, and the client keeps that
  process's `instructions`; the process that goes on to serve never sees the
  probe. A session path named in `instructions` is therefore already deleted
  when the agent reads it. Instructions name the repository root and
  `.noesis/tmp/`; the live session directory is named in each tool's `path`
  parameter description, which `tools/list` answers from the serving process.
- **Boot is in two halves, because a 2026-era host starts the process twice.**
  The era probe spawns a throwaway sibling from the same command, so whatever
  `main.ts` does before it can answer `server/discover` is paid for twice per
  session — once by a process that is reaped seconds later. The first half is
  the MCP surface and costs milliseconds: config, `.noesis/`, logging, the
  session directory, the file repositories, `serveStdio`. The second half is
  the LadybugDB binary, the database, the graph index, the watcher and the
  page, and it starts on the first inbound message that is not
  `server/discover` — `ServingTransport`
  (`adapters/mcp/serving-transport.ts`) is `StdioServerTransport` with that
  one thing observed, passed in as `ServeStdioOptions.transport`. The signal
  is exact and needs no timer: the probe receives `server/discover` and
  nothing else, and the process that serves never receives it at all, since
  on the modern era the client takes the era, the capabilities and the
  instructions from the probe's answer and sends no `initialize`. A host that
  probes in place reaches the same conclusion one message later, a 2025-era
  host on `initialize`. Nothing awaits the second half — both tools run on the
  file repositories alone, so a session's first request is answered while the
  page comes up behind it, and a database that will not open leaves the tools
  serving instead of killing the session. A terminal on stdin (`bun run dev`,
  the bin started by hand) means no host is speaking MCP, and the page is the
  point of that run, so it starts at once. `shutdown()` awaits the half if it
  is still coming up, or nothing knows what holds the database and the port.
  What is left of the probe: two log files' worth of lines, and a session
  directory it creates and deletes.
- **zod is pinned at `^4.2.0` or above** in the root catalog because the v2
  SDK converts schemas through the authoring zod's `~standard.jsonSchema`:
  below 4.2 it falls back to its own bundled copy and silently **drops every
  `.describe()`** from the advertised JSON Schema.
- **MCP tools are thin:** each validates its input and calls one service method
  in-process.
- **Large payloads move through the temp dir.** The agent writes a working file
  under `.noesis/tmp/<session>/` and passes its path; MCP messages carry
  coordinates, not content. A working file above
  `MAX_WORKING_FILE_BYTES` (4 MiB) is refused unread: one document is never
  that large, so such a path is the wrong one and reading it would pull it
  into memory before the shape is known. A path is accepted under either
  spelling of the scratch root — as configured, and as it resolves — because
  an agent that resolves paths itself passes the second. The traffic is
  one-way for now: nothing spills outbound, because both tools answer in one
  line. `SessionDir` carried a `deliver()` that wrote an oversized answer to a
  `result-N.txt` beside the working files; it went with the tools that
  returned lists, and comes back with the first tool that needs it.
- **A write that follows a uniqueness check is serialised in its service.**
  `ChangesService.create` and `DocumentsService.create`/`update` run check and
  write as one step through `Serial` (`app/serial.ts`, a promise chain): an
  agent fires tool calls in parallel, the store's write is temp-file-plus-rename
  and so overwrites, and two checks that both pass would let the second create
  silently replace the first. In-process order is enough for the ui and the
  agent of one session, which share the service instances; two sessions on one
  repository are not covered.
- **Validation happens once, where the write happens.** A tool that reads a
  working file checks it against its contract
  (`src/app/validation/contracts`) before the service sees it and rejects the
  call having written nothing; there is deliberately **no separate
  `validate` tool**. A pre-flight tool only asked the agent to pay for the
  same check twice and let the two answers drift; the rejection the write
  returns is the one answer, and it arrives where it matters. Errors are
  actionable — path, expected versus found, a one-line correction — capped,
  and returned in-band (`isError` results the model can read), never as
  protocol errors. Unreadable JSON and a path outside the session scratch
  directory come back the same way, as does a working file above the size
  cap.
- **The ui never authors a design document.** `/ui/changes/:change/design-docs`
  reads (`GET /`, `GET /:id`) and deletes (`DELETE /:id`); authoring one is the
  agent's. One authoring path means one place where the contract and the
  integrity check run, and the browser cannot put a document in that no skill
  produced. Since the MCP surface was rebuilt there is no authoring tool yet,
  so a design document cannot currently be created at all — the route stays
  read-and-delete rather than growing a write to fill the gap. `documents`
  keeps its ui writes: a person pastes a source there.
- **The ui routes check their request envelope with `@hono/standard-validator`**
  (`sValidator('json', …)`), not a zod-specific adapter: the middleware speaks
  Standard Schema, so the schema library stays an implementation detail of
  `app/<feature>/model/`. The schema the middleware takes is the file's own
  contract, not an opaque object, so a write route validates in one pass and
  a body that does not fit never reaches the handler; the answer is
  `400 {error:'invalid_body', issues}` from the package's `flattenErrors`.
  The service-side `validate` is for what a schema cannot say — a
  whole-document `check`. `design-document` has one (its integrity pass) and
  so does `document`: its id is the title as a slug, so a title the slug
  empties is refused; there is no fallback id for such titles to share. The
  checks run on the MCP side, where they owe the agent a report. The title
  rule is also the service's own: `DocumentId.fromTitle` throws
  `TitleWithoutIdError`, so the ui's document writes — the schema pass over
  `CreateDocumentSchema`, the id being the service's to derive — answer
  `400 {error:'title_without_id', title}` instead of storing under a shared id.
- **Search** is `GET /ui/search` over a `SearchProvider[]` registry in
  `SearchService`. The agent's search tool is not part of the rebuilt MCP
  surface yet.
- **LadybugDB** is `@ladybugdb/core` (0.20.x), opened as `:memory:` with a
  256 MB buffer pool (the graph's whole memory: in-memory cannot spill), one
  `Database` with two connections owned by `DatabaseService`: a **reader**
  behind `query()` (auto-commit, one statement per call, 5 s query timeout
  because reads are user-driven; writes have none) and a dedicated
  **writer** behind `transaction(fn)`, which serialises callers, wraps `fn` in
  `BEGIN TRANSACTION` … `COMMIT` and rolls back on throw. Two connections
  because a transaction's scope is the connection — on a shared one every
  concurrent query joins the open transaction — and LadybugDB allows one
  write transaction at a time while readers see the last committed
  snapshot, so a rebuild swaps the graph atomically and a write outside
  `transaction()` during one fails loudly rather than interleaving. Every
  write (DDL included, which is transactional) goes through `transaction()`;
  `query()` is for reads. Both connections keep a prepared-statement cache
  keyed by the Cypher text (prepare once, execute many — 0.20.x's cached-plan
  fast path), return fully materialised rows and close every `QueryResult`
  eagerly. `init()` initialises the native handles eagerly and refuses a
  second call; `close()` waits for in-flight work, then closes writer,
  reader, database. It is a native module: the one `--external` of the bundle
  and the one runtime `dependency` of the published package (with
  `trustedDependencies`, so its install script places the platform binary).
  Any future native or file-reading dependency follows the same pattern.
- **`shutdown()` is idempotent**: a second signal must not start a second
  teardown.
- **Configuration:** `NOESIS_ROOT`, `NOESIS_OPEN_BROWSER=0` (headless runs and
  tests), `NOESIS_LOG_LEVEL`, and `PORT` as a stable development URL only.
  That is the whole list.
- Test layout: `test/unit`, `test/integration`, `test/e2e`, `test/bench` in
  apps; contract specs are `test/unit/contracts-*.spec.ts`.

## D4. Contracts: the domain model as declarative zod in `src/app/<feature>/model/`, shipped to the agent as source

- **All contracts are zod v4 schemas with inferred types, and those types
  are the domain model.** `Change`, `DesignDocument`, `Topic`, … are the
  entities the services take; there is no second, hand-written entity type.
  Each feature owns its contracts in `server/backend/src/app/<feature>/model/`
  (`changes`, `design-docs`, `information-sources`, `wiki`, `system-model`),
  consumed as TypeScript source (no build step, no workspace package). The
  service imports them by file; the frontend type-only through its
  `#backend/*` alias; the plugin copies every `model/` folder. Runtime
  helpers that are not part of the model never go inside `model/`, so the
  plugin copy carries nothing but the model: time-ordered
  ids come straight from the `uuid` package (`v7`), content-hash ids from
  `src/platform/crypto/content-hash.ts`.
- **Contracts are declarative on purpose:** object shapes, enums, `.describe()`
  text; no refinements, no transforms, no imports beyond zod and other
  contract files (relative, also across features).
  The agent reads the `.ts` source directly; what a shape cannot say goes in
  `.describe()` text. Whole-document rules live beside the schema in the
  file contract (`src/app/validation/contracts`), which every write boundary
  checks against.
- **Value objects are part of the model and the schemas use them.** A value
  object is a class in `model/` that exists only in valid form (private
  constructor, `parse`/`tryParse`, its derivations, `equals`, `toJSON`), and
  it exports a `z.codec` beside itself: the JSON side is a declarative string
  schema carrying the whole rule (`max`, `regex`), the other side the class.
  A contract names that codec for the field, so the inferred entity holds the
  value object while disk, HTTP and the advertised JSON Schema keep the plain
  string, and the file stays within the rule above (zod only, no `transform`).
  The store parses what `set` is given and writes the encoded side; the
  repository adapter encodes the entity before handing it over; a route
  parses a path parameter with `tryParse` and answers 404 for a malformed
  one; an MCP tool unwraps `.value` into `structuredContent`. `DocumentId`
  (`information-sources/model/document-id.ts`, the `document_id` of
  `DocumentSchema`) is the first; `ChangeSlug` still sits beside its service
  with a plain-string `slug` in `ChangeSchema` and is to follow.
- **The plugin's `contracts/` is the one readable copy, and it is a build
  output.** `plugins/claude-code/tools/copy-contracts.ts` copies every
  `server/backend/src/app/<feature>/model/` folder, keeping the path relative
  to `src/app/` so cross-feature relative imports still resolve, with a
  header naming the plugin version;
  `bun run build` / `prepack` runs it; the directory is gitignored except its
  README. The plugin's tests assert byte-identity with the source and
  declarativeness; the tarball test asserts the copy is packed. Skills name a
  contract by a path under `${CLAUDE_PLUGIN_ROOT}/contracts/`. The service
  package ships no readable copy — it bundles the schemas.
- **Locked fields.** `<field>_locked: true` beside a field means a person
  edited it; skills preserve it and ask before changing it. Only topic and
  decision fields carry locks today. Design documents record authorship per
  element instead (`human` means do not rewrite unasked).
- **The design-doc model is normalised:** flat arrays of actors, bounded
  contexts, domain modules, building blocks, use cases and behaviours, related
  by id. Every rendered element carries a stable id
  unique across the whole document; nothing is addressed by position. An
  address is an `ElementRef` (`{kind:'element', id}` or
  `{kind:'slot', ownerId, path}`); there is no string form. A use case and a
  behaviour are separate types naming each other; an application service is a
  building block of type `application_service`. Referential integrity is a
  separate whole-document pass (`checkDesignDocument`), since zod validates one
  object at a time.
- **`DesignDocument` is the interchange format and the validated write
  boundary.** Every write is whole-document replacement, written as a file.
  There is no server-side edit path; an editor is a new decision.
- **Validation is a boundary concern, not a service one.** The ui routes and
  the MCP tools run the contract (`src/app/validation`, in `app` so both
  can reach it) and answer a 400 or
  an in-band issue list; an application service such as `DesignDocsService`
  takes the typed, already-valid document. The store's schema parse on write
  is the last guarantee, not a second boundary.
- **Deferred, not designed here:** the codebase-delta feature (Existing / New /
  Modified / Removed against a scanned baseline), change-set combinators and
  locks for design docs, and any agent chat surface in the UI. When the delta
  returns, one rule travels with it: Modified derives only from
  scanner-comparable fields and does not propagate upward through containment.

## D5. Frontend: client-only React SPA on TanStack Router and Mantine, bundled by bun, change-scoped shell

- **`server/frontend` is a client-only SPA**: React 19, TanStack Router
  (file-based), TanStack Query, Mantine. No SSR and no server functions.
  Anything that needs a server is a Hono route on `/ui`.
- **Production: bun's fullstack mode.** `server/backend/src/main.ts` imports
  `../../frontend/index.html` and serves it from `Bun.serve`'s `/*` route; the
  backend's single `bun build` emits `dist/main.js`, `dist/index.html` and
  hashed assets. The frontend package has no production build of its own. The
  build flags (`--entry-naming '[name].[ext]'`, `--public-path /`, explicit
  `NODE_ENV=production`) and `src/bundle-cwd.ts` are load-bearing; re-check them
  on a bun upgrade.
- **Development: Vite is the dev server only.** Root `bun run dev`
  (`server/scripts/dev.ts`) runs the backend on `:3001` (watch, browser not opened) and
  Vite on `127.0.0.1:3000` with React Fast Refresh, proxying `/ui` and
  `/internal`. Vite never produces the shipped bundle.
- **The frontend calls `/ui` through Hono's typed RPC client**,
  `hc<AppType>('/ui')`, in `src/api/client.ts`. `AppType` comes from
  `server/backend/src/app.types.ts` (the `/ui` route tree only) via the
  `#backend/*` import alias, as a **type-only** import: the frontend never
  imports backend runtime code. Payload types come from
  the contract files under `#backend/app/<feature>/model/` the same way. The client's fetch wrapper mints `x-request-id`
  (D10) and raises `ApiError` carrying the service's `{ error }` text.
- **TypeScript: one config per runtime** (the create-vite layout), checked
  with `tsc -b`: `tsconfig.app.json` (`src`, `vite/client` types only — no
  Bun or Node globals, so a browser file using them fails to type-check),
  `tsconfig.node.json` (`vite.config.ts`, Node types) and `tsconfig.test.json`
  (`src` and `test`, Bun types for `bun:test`). The solution `tsconfig.json`
  holds the `#/*` and `#backend/*` `paths` and the app config extends it,
  because bun's bundler and test runner read `paths` only from
  `tsconfig.json` and do not follow references.
- **Backend code the frontend's types reach stays runtime-neutral.** `AppType`
  pulls the `/ui` route tree — routes, the app services behind them,
  contracts — into the app program, which has no Bun or Node types, so that
  code uses ECMAScript and Web APIs only. Time-ordered ids therefore come from
  the `uuid` package's `v7`, not `Bun.randomUUIDv7()`; the `node:crypto`
  content hashes live in `platform/crypto`, which only adapters import. The
  services' `Array.fromAsync` is why the app config adds `ESNext.Array` to
  `lib`.
- **Routing.** A pathless `_shell` layout route; routes carry the change slug:
  `/changes/$changeId[/documents|/conversations|/design-docs]`, plus
  `/system-model` and `/wiki`. `/` redirects to the last-opened change
  (`localStorage` `noesis.shell.lastChangeId`), else the first, else an empty
  state. There are no breadcrumbs. `src/routeTree.gen.ts` is generated by `tsr generate`
  (`bun run generate-routes`) and committed. Routes are not code-split.
- **Route files export `Route` and nothing else** (Oxlint's
  `react/only-export-components`); view components live in `src/components/`.
- **The shell is change-scoped:** a picker at the top of a 280 px sidebar names
  the current change; under it exactly four change views (Overview, Documents,
  Conversations, Design docs); a pinned "Documentation" zone holds System model
  and Wiki. Below `md` the sidebar is Mantine's `AppShell` drawer.
- **Mantine is the component library** (`@mantine/core`, `hooks`, `form`);
  icons are `@tabler/icons-react`.
- **Brand:** cool-toned after noesis.vision — `blue-700` primary through a
  `brand` ramp in `createTheme`, Raleway (`@fontsource-variable/raleway`),
  `defaultRadius: 'sm'`. Colour scheme `auto` by default, persisted under
  `noesis.shell.colorScheme`; `index.html` inlines the scheme bootstrap so a
  dark reload does not flash.
- `docs/stack.md` lists only what the backend and the frontend actually depend
  on; a library is added there when something imports it, not before.

## D6. Plugin, npm distribution and releases

- **`plugins/` holds what ships to agent hosts**, one folder per harness;
  `plugins/claude-code` follows the official Claude Code plugin layout
  (`.claude-plugin/plugin.json`, `contracts/`, `.mcp.json`, and `skills/` when
  there are skills to ship; dev tooling in unshipped `tools/`, never in
  `scripts/` or `bin/`, which have plugin semantics). The plugin is content:
  contract sources, launch config, and the skills that drive the tools. The
  four skills that drove the first MCP surface went with it; skills come back
  one per rebuilt tool: `create-change` for `create_change` and
  `add-document-to-change` for `add_document_to_change`. A skill that turns a
  user's file into a working file does it with a script in its own `scripts/`
  folder, run with `bun`, so the text is copied byte for byte and never
  retyped by the model. Skills live here, versioned in this repository;
  nothing is copied into the user's project.
- **Two published packages, one version train:** `@noesis-vision/noesis` (the
  service: `bin` → `dist/main.js`, `files: ["dist"]`) and
  `@noesis-vision/claude-code-plugin`. They always release together at the same
  version; the service publishes first so the plugin's pin always resolves.
- **Launch.** The plugin's `.mcp.json` runs
  `${NOESIS_SERVICE_COMMAND:-bunx} ${NOESIS_SERVICE_ENTRY:-@noesis-vision/noesis@<version>}`
  with `NOESIS_ROOT=${CLAUDE_PROJECT_DIR}`. Unset, an installed plugin runs the
  pinned published bin. To develop against a checkout: `bun run build:plugin`,
  then start Claude Code in a sample repository with `--plugin-dir` pointing at
  the checkout, `NOESIS_SERVICE_COMMAND=bun` and
  `NOESIS_SERVICE_ENTRY=<repo>/server/backend/src/main.ts`. bun is the only
  runtime requirement.
- **Marketplace.** `plugins/claude-code/.claude-plugin/marketplace.json`, added
  by direct raw URL (no clone). Two entries, `noesis` and `noesis-beta`, each
  pinned to an exact semver; `bun run bump` advances the entry matching the
  bumped version's prerelease-ness.
- **The plugin's `package.json` is the single version source.**
  `bun run generate` stamps `plugin.json` and the `.mcp.json` pin from it;
  generated output is committed and CI-checked (D8). The contracts copy is not
  committed (D4).
- **Releases are tag-driven.** Pushing `v*` runs `release.yml`: verify
  (`bun run format:check && bun run ci`), generate-drift check, tag↔version
  assertion across both manifests, `bun pm pack` (rewrites `workspace:*` and
  `catalog:`), then `npm publish <tarball>` via npm trusted publishing (OIDC, no
  token, provenance). Dist-tag derives from the version: a prerelease → `beta`,
  else `latest`. Flow: `bun run bump <ver>` → `bun run generate` → commit →
  `git tag v<ver>` → push the tag.
- Tarball tests pack the real package, assert the file whitelist and a
  `workspace:`/`catalog:`-free manifest, and boot the built bin from another
  directory.

## D7. Repository layout, toolchain and working conventions

- **The bun workspace owns the repo root; minority languages live in
  self-contained subtrees.** `server/` (`backend`, `frontend` — the Noesis
  service), `plugins/` (shipped to agent hosts), `scanners/` (`java`,
  `dotnet`, own build files), `docs/`. Package names are `backend` and
  `frontend`. There is no `packages/` directory: shared tooling config is
  root files, not workspace members (a one-file `@repo/typescript-config`
  package was more manifest than content).
- **Pure bun workspace.** Root scripts are
  `bun run --filter '*' <task>`; root `bun run ci` is the one definition of
  "verified" (lint, knip, format check, type-check, test, e2e, build).
- **TypeScript 7** (native compiler), resolved through the root catalog; `tsc`
  only type-checks, as `check-types` — bun runs and bundles everything. The
  root `tsconfig.base.json` is bun's recommended preset (bundler mode,
  `module: Preserve`, ESNext, `verbatimModuleSyntax`, `noEmit`,
  `types: ["bun"]`), extended by relative path by the root, backend and
  plugin configs. The frontend has its own configs (D5).
- **The root catalog holds only deps that must stay in lock-step** across
  workspaces (zod, hono, typescript, `@types/*`);
  single-consumer deps stay inline. `^` ranges plus a frozen `bun.lock`.
- **Oxlint lints and Oxfmt formats everything**, from the root
  `.oxlintrc.json` and `.oxfmtrc.json` — one toolchain (Oxc), no Biome, no
  Prettier, no separate dependency checker. Oxlint runs the `correctness`
  category plus type-aware rules through tsgolint (built on TypeScript 7's
  own compiler, so no TypeScript 6 on the side), and the backend's layers
  (D3) through eslint-plugin-boundaries, loaded as a JS plugin (alpha), with
  the oxc import resolver. Oxfmt is Prettier-compatible at 80 columns,
  formats Markdown too, and sorts imports without blank lines between
  groups. `bun run lint` does not check formatting; `format:check` does, and
  the root `ci` script runs both.
- **Knip finds what no file uses** (`bun run knip`, root `knip.json`):
  unused files, exports, exported types and dependencies across the
  workspaces — the cross-file dead code a per-file linter cannot see. A
  deliberate duplicate export carries a `@alias` JSDoc tag; entry points
  Knip cannot discover (type-only tests, subprocess helpers) are listed in
  the config.
- **Git hooks via `core.hooksPath`, no hook manager.** One hook,
  `.githooks/commit-msg`, validates the subject and then runs
  `.githooks/check-staged` (`oxfmt --check` and `oxlint` on the staged
  files). The root `prepare` script activates it. Heavier checks are
  deliberately not hooked.
- **WIP commits skip every check.** A subject starting `wip` (`wip`,
  `wip: …`, `WIP …`) bypasses both the message rule and the staged-file
  checks. The checks live in `commit-msg` rather than `pre-commit` for this:
  `pre-commit` runs before the message exists. WIP commits are squashed
  before they reach `main` — nothing enforces that yet.
- **Commits follow Conventional Commits v1.0.0 with exactly four types:**
  `feat`, `fix`, `improvement` (one-time betterment, behaviour unchanged —
  subsumes refactor, perf, docs, tooling) and `chore` (recurring maintenance).
  Cadence decides improvement versus chore. The `commit-message` skill
  generates messages.

## D8. CI and dependency automation

- **Change detection is job-level, not workflow-level.** A `changes` job
  (`dorny/paths-filter`) exposes `ts` and `java`; downstream jobs gate with
  `if:` so skipped jobs still satisfy required checks. Workflow edits are in
  both filters.
- **Jobs:** `format` (ungated — Oxfmt covers Markdown, so doc-only commits
  are checked), `verify` (lint, knip, type-check, test, e2e, build — runs the whole TS
  suite on every gated push), `generate-check`
  (`bun run generate` must leave the tree clean), and the Java scanner job
  (`mvn verify`, Temurin 17).
- **All actions are pinned to full commit SHAs** with the tag in a trailing
  comment; npm is pinned to its major (`npm@11`). `--frozen-lockfile`
  everywhere; bun pinned through `packageManager`.
- **The release gate reuses the root `ci` script** (D6); `ci.yml` keeps split
  steps for per-step names and timings but invokes the same root scripts.
- **Renovate (hosted Mend app, `renovate.json`)**: `config:recommended`, weekly
  Monday schedule, `minimumReleaseAge` 3 days, no automerge, GitHub Actions and
  Maven bumps grouped. Known gap: `workspaces.catalog` entries are invisible to
  Renovate until upstream support lands — update those by hand
  (`bun outdated` / `bun update`).

## D9. Scanners: TypeScript in-process; Java is ArchUnit + Spoon; JVM/.NET integration deferred

- **The TypeScript scanner is a service component**
  (`server/backend/src/adapters/scanner`). It reads the checkout's source and
  writes `.noesis/graph/system-model/`. The tool that ran it is not part of the
  rebuilt MCP surface yet, so nothing drives it from the composition root
  meanwhile.
- **Scanning always runs where the code is**; only derived model data is
  written, into the user's own repository.
- **`scanners/java` is a standalone Maven tool, not yet integrated** with the
  service; `scanners/dotnet` is a stub. How they feed `system-model/` is an
  open decision — do not invent an upload API or a server ingestion surface.
- **Java engine:** ArchUnit's `ClassFileImporter` produces the graph from
  bytecode; Spoon adds a source-fidelity pass (positions, comments, parameter
  names) as optional fields keyed by FQN + member descriptor. Engines stay
  invisible above `scanner-core`; build-tool plugins only gather inputs and
  must isolate classloaders (Spoon's JDT is unshaded). jQAssistant (GPLv3) and
  CodeQL were rejected on licence.
- **Java graph schema — typed DDD graph, closed vocabulary.** `Command`,
  `Query`, `Event` are first-class message nodes; `SENDS`/`HANDLES` edges point
  at messages, never block-to-block. Building blocks contain `Behaviour` nodes
  (id `fqn#method(paramTypes)`); `INVOKES` is behaviour-level and block-to-block
  usage is derived by lifting it through `CONTAINS`. Commands and queries have
  exactly one handler, events 0..n. Stereotypes default to the jMolecules
  vocabulary through a configurable annotation mapping; unmapped custom
  annotations are dropped. Full taxonomy: `scanners/java/design-doc.md` §9.4.

## D10. Logging is LogTape, in the service and the browser

- **`@logtape/logtape` in both packages.** Modules only call the helpers
  `serverLogger('<module>')` / `uiLogger('<module>')`; one place per process
  calls `configure()`. Categories are `noesis.<process>.<module>`. Messages use
  named placeholders and a properties object, never string interpolation. No
  `console.*` except the two failures before logging exists (bad config, no
  repository root).
- **The service always writes two sinks:** stderr (coloured text from source,
  JSON lines in the built bin — stdout stays the MCP transport) and
  `.noesis/logs/noesis.log` (JSON lines, write-through, rotated at 5 MB, five
  files). `NOESIS_LOG_LEVEL` sets the floor, `info` by default.
- **Request ids tie the three sides together.** The Hono middleware takes
  `x-request-id` or mints one, echoes it, and opens a LogTape context so every
  line under the request carries it; the MCP dispatcher does the same per tool
  call; the browser's fetch wrapper mints the id and logs the call under it.
- The browser configures one console sink and logs uncaught errors and
  unhandled rejections under `noesis.ui.window`.
- LogTape packages are devDependencies of the service (the bin bundles them).
  Conventions and the module list: `docs/logging.md`.
