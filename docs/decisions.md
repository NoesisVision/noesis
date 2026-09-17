# Architecture Decisions — current

The ten decisions in force, D1–D10. Everything here describes the tree as it
is; if this file and the code disagree, that is a bug in one of them — say so
rather than picking one silently.

_Last updated: 2026-09-17, checked against the code on that date._

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
  indexes it). `NoesisDir.ensure()` creates them and maintains
  `.noesis/.gitignore`. Everything under `graph/` is committed.
- **`NoesisStore` is the only write path** (`server/backend/src/files/`). A
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
- **Ids.** Imported sources get a content hash (re-import is a duplicate, not a
  copy); entities the graph authors get a time-ordered id the service mints. A
  reference is the target's id; a fragment ref into an imported source also
  carries `source_sha`.
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

The store's full contract: `docs/work/improvements/noesis-store.md`. File
conventions for skills: `packages/shared-contracts/src/conventions.md`.

## D3. Service internals: Hono on `Bun.serve`, surfaces by consumer, thin MCP tools, validate-then-write

- **`server/backend` is a Hono app on `Bun.serve` with an explicit composition
  root** (`main.ts` constructs services, wires `createApp(deps)`, owns
  lifecycle). Surfaces are factory functions taking narrow deps interfaces.
- **Routes are segregated by consumer:** `/ui/*` (the SPA) and `/internal/*`
  (health and technical endpoints). The agent does not use HTTP — it reaches the
  same services over MCP on stdio. Surface routes win over the SPA's `/*` route, so a surface 404 is
  never swallowed by the page. stdout belongs to the MCP transport; everything
  else writes to stderr.
- **Keep the `.route()` chains unbroken** in `app.ts` and `ui.routes.ts`: Hono
  infers the route tree from the expression, and the frontend's typed client
  depends on it (D5).
- **MCP tools are thin:** each validates its input and calls one service method
  in-process. Every tool is defined against a contract in
  `src/mcp/contracts/registry.ts`; there is deliberately no way to register a
  tool without one. Current tools: `list-changes`, `import-conversation`,
  `import-document`, `list-design-docs`, `create-design-doc`,
  `update-design-doc`, `scan-system-model`, `search-knowledge-graph`,
  `validate`.
- **Large payloads move through the temp dir.** The agent writes a working file
  under `.noesis/tmp/<session>/` and passes its path; MCP messages carry
  coordinates, not content. The server's `instructions` field names the root
  and the session directory.
- **Validation happens twice with the same schemas:** the `validate` tool
  against the working file, and again at the write boundary. Errors are
  actionable — path, expected versus found, a one-line correction — capped, and
  returned in-band (`isError` results the model can read), never as protocol
  errors.
- **Search** is `GET /ui/search` and the `search-knowledge-graph` tool over a
  `SearchProvider[]` registry in `SearchService`.
- **LadybugDB** is `@ladybugdb/core`, opened as `:memory:`. All access goes
  through `DatabaseService.query()`, which returns fully materialised rows and
  closes every `QueryResult` eagerly; the connection closes before the
  database. It is a native module: the one `--external` of the bundle and the
  one runtime `dependency` of the published package (with
  `trustedDependencies`, so its install script places the platform binary).
  Any future native or file-reading dependency follows the same pattern.
- **`shutdown()` is idempotent**: a second signal must not start a second
  teardown.
- **Configuration:** `NOESIS_ROOT`, `NOESIS_OPEN_BROWSER=0` (headless runs and
  tests), `NOESIS_LOG_LEVEL`, and `PORT` as a stable development URL only.
  That is the whole list.
- Test layout: `test/unit`, `test/integration`, `test/e2e`, `test/bench` in
  apps; contract packages co-locate specs in `src/`.

## D4. Contracts: declarative zod in `@repo/shared-contracts`, shipped to the agent as source

- **All contracts are zod v4 schemas with inferred types** in
  `packages/shared-contracts`, consumed as TypeScript source (no build step).
  It is the only contracts package. Type-only consumers use type-only imports.
- **Contracts are declarative on purpose:** object shapes, enums, `.describe()`
  text; no refinements, no transforms, no imports beyond zod and sibling files.
  The agent reads the `.ts` source directly. What a schema cannot say lives in
  a companion `.md` beside it (`conventions.md`, `design-doc.md`, `wiki.md`, …).
- **The plugin's `contracts/` is the one readable copy, and it is a build
  output.** `plugins/claude-code/tools/copy-contracts.ts` copies
  `packages/shared-contracts/src` with a header naming the plugin version;
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
  on a bun upgrade (`docs/work/chores/bun-fullstack-spike.md`).
- **Development: Vite is the dev server only.** Root `bun run dev`
  (`scripts/dev.ts`) runs the backend on `:3001` (watch, browser not opened) and
  Vite on `127.0.0.1:3000` with React Fast Refresh, proxying `/ui` and
  `/internal`. Vite never produces the shipped bundle.
- **The frontend calls `/ui` through Hono's typed RPC client**,
  `hc<AppType>('/ui')`, in `src/api/client.ts`. `AppType` comes from
  `server/backend/src/app.types.ts` (the `/ui` route tree only) via the
  `#/server/*` import alias, as a **type-only** import: the frontend never
  imports backend runtime code. Payload types come from
  `@repo/shared-contracts`. The client's fetch wrapper mints `x-request-id`
  (D10) and raises `ApiError` carrying the service's `{ error }` text.
- **Routing.** A pathless `_shell` layout route; routes carry the change slug:
  `/changes/$changeId[/documents|/conversations|/design-docs]`, plus
  `/system-model` and `/wiki`. `/` redirects to the last-opened change
  (`localStorage` `noesis.shell.lastChangeId`), else the first, else an empty
  state. Breadcrumbs come off the matches (`staticData.breadcrumb` plus the
  change layout's loader data); there is no breadcrumb map.
  `src/routeTree.gen.ts` is generated by `tsr generate`
  (`bun run generate-routes`) and committed. Routes are not code-split.
- **Route files export `Route` and nothing else** (biome's
  `useComponentExportOnlyModules`); view components live in `src/components/`.
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
- `docs/stack.md` lists only what the frontend actually depends on; a library
  is added there when something imports it, not before.

## D6. Plugin, npm distribution and releases

- **`plugins/` holds what ships to agent hosts**, one folder per harness;
  `plugins/claude-code` follows the official Claude Code plugin layout
  (`.claude-plugin/plugin.json`, `skills/`, `contracts/`, `.mcp.json`; dev
  tooling in unshipped `tools/`, never in `scripts/` or `bin/`, which have
  plugin semantics). The plugin is content: skills, contract sources, companion
  docs, launch config. Skills live here, versioned in this repository; nothing
  is copied into the user's project.
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
  service), `plugins/` (shipped to agent hosts), `packages/` (internal
  libraries: `shared-contracts`, `typescript-config`), `scanners/` (`java`,
  `dotnet`, own build files), `docs/`. Package names are `backend` and
  `frontend`.
- **Pure bun workspace.** Root scripts are
  `bun run --filter '*' <task>`; root `bun run ci` is the one definition of
  "verified" (lint, Markdown lint, type-check, test, e2e, build).
- **TypeScript 7** (native compiler), resolved through the root catalog; `tsc`
  runs only as `check-types` (`--noEmit`). `@repo/typescript-config` holds the
  presets: `base.json` is `ES2022` only, DOM libs are opt-in per app type.
  Internal packages export `src/*.ts`.
- **The root catalog holds only deps that must stay in lock-step** across
  workspaces (zod, hono, typescript, biome, prettier, `@types/*`);
  single-consumer deps stay inline. `^` ranges plus a frozen `bun.lock`.
- **Biome 2 lints and formats all code** from one root `biome.json`
  (`bun run lint` = `biome check .`, imports organised); **Prettier is for
  Markdown only**.
- **Git hooks via `core.hooksPath`, no hook manager.** `.githooks/pre-commit`
  runs `biome check --staged` and `prettier --check` on staged Markdown;
  `.githooks/commit-msg` validates the subject. The root `prepare` script
  activates them. Heavier checks are deliberately not hooked; `git commit -n`
  is the WIP escape hatch.
- **Commits follow Conventional Commits v1.0.0 with exactly four types:**
  `feat`, `fix`, `improvement` (one-time betterment, behaviour unchanged —
  subsumes refactor, perf, docs, tooling) and `chore` (recurring maintenance).
  Cadence decides improvement versus chore. The `commit-message` skill
  generates messages.
- **Work starts as a task doc** under the narrowest scope's `docs/work/<type>/`
  folder, created by the `init-task` skill. A task doc is problem-space only;
  what solutioning decides belongs in this file. The task's `scope` doubles as
  the commit scope.

## D8. CI and dependency automation

- **Change detection is job-level, not workflow-level.** A `changes` job
  (`dorny/paths-filter`) exposes `ts` and `java`; downstream jobs gate with
  `if:` so skipped jobs still satisfy required checks. Workflow edits are in
  both filters.
- **Jobs:** `format` (ungated — Prettier covers Markdown, so doc-only commits
  are checked), `verify` (lint, type-check, test, e2e, build — runs the whole TS
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
  (`server/backend/src/scanner`), run by the `scan-system-model` tool. It reads
  the checkout's source and writes `.noesis/graph/system-model/`.
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
