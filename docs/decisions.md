# Architecture Decision Log

Decisions made while shaping this monorepo, in chronological order. Format: context → decision → rationale/consequences.

_Last updated: 2026-08-18_

---

## 1. Shared TypeScript config presets

**Context:** `ui`, `server`, and `local` each carried standalone tsconfigs; only `web-contracts` used `@repo/typescript-config`.

**Decision:** Add `nest.json` and `vite.json` presets to `@repo/typescript-config` (mirroring `eslint-config`'s `nest.js` / `vite-react.js` split) and reduce app tsconfigs to deltas only (`outDir`, `baseUrl`, lib/types/jsx).

**Rationale:** One source of truth per app type. Behavior was preserved exactly — the Nest apps keep their NestJS-default looseness (`strict: false` + `strictNullChecks`) rather than inheriting `base.json`'s full strictness, so the migration could not break builds. Tightening later is a separate, deliberate step.

## 2. Remove create-turbo leftovers

**Decision:** Delete unused presets (`typescript-config/nextjs.json`, `react-library.json`; `eslint-config/next.js`, `react-internal.js`) and the deps only they used (`@next/eslint-plugin-next`, `eslint-plugin-react`). Fix `turbo.json` `build.outputs` from `.next/**` to `dist/**`.

**Rationale:** No Next.js apps remain. Wrong `outputs` meant turbo cached no build artifacts at all ("no output files found" warnings).

## 3. Contracts package naming and split

**Decision:** Rename `web-contracts` → `ui-contracts`. Create `local-contracts` (server↔local DTOs) and later `shared-contracts` (DTOs common to ui/local/mcp). Each pair-specific package re-exports `@repo/shared-contracts`.

**Rationale:** Names follow the consuming app. Contract packages are consumed as TypeScript source (`exports` → `src/*.ts`, no build step) — bun and the bundlers handle TS directly, keeping the packages dependency-light. Apps import their own contracts package and see common DTOs through the re-export, so the shared package stays an internal detail.

## 4. zod as the schema language

**Decision:** All contracts are zod (v4) schemas with inferred TS types (`z.infer`), not plain interfaces. `mcp-contracts` exposes a `contracts` registry (`name → {schema, example}`) plus a `toJsonSchema()` helper.

**Rationale:** One definition feeds three consumers: runtime validation (`safeParse`), JSON Schema generation (`z.toJSONSchema`, draft 2020-12) for model-facing skill references, and static types. Consumers needing only types use type-only imports — zod is erased from their runtime. The registry + helper keep zod itself encapsulated in the contracts package, so future harness plugins (Codex, OpenCode, pi) write generators without depending on zod directly.

## 5. Plugins live in `plugins/`, one folder per harness

**Decision:** Top-level `plugins/` (workspace members) separate from `packages/`. `plugins/claude-code` follows the official Claude Code plugin layout (`.claude-plugin/plugin.json` manifest; `skills/`, `bin/`, `servers/`, `.mcp.json` at plugin root).

**Rationale:** Plugin folders must follow each harness's mandated structure and shouldn't be forced into library conventions. Workspace membership gives plugin scripts full TS access to the contract packages (a future-proofing requirement: validation scripts import the real zod schemas, no duplication).

## 6. Generated skill references are committed

**Decision:** `turbo generate` emits `skills/*/references/*.schema.json` + `*.example.json` from `@repo/mcp-contracts`, and the output is committed (not gitignored).

**Rationale:** Skills are static markdown + JSON read by the model; they cannot import TS. The plugin must be self-contained when installed outside the monorepo — installers don't run our turbo pipeline. Drift is prevented by CI (decision 11).

## 7. ⚠️ bun does not resolve package-specifier tsconfig `extends`

**Context:** After migrating to `"extends": "@repo/typescript-config/nest.json"`, both Nest apps **broke at runtime** — bun's transpiler silently lost `experimentalDecorators`/`emitDecoratorMetadata` and compiled TC39 standard decorators, which Nest DI cannot use. `tsc` resolved the extends fine, so type checks stayed green and the breakage was invisible until boot.

**Decision:** Duplicate the two decorator flags inline in `apps/{server,local}/tsconfig.json`, with a comment explaining why they must not be removed.

**Consequence:** Any new bun-run Nest app needs the same inline flags. Verification lesson: `tsc --noEmit` is not sufficient for tsconfig changes in bun apps — boot the app.

## 8. MCP server lives in `apps/local`, speaks stdio

**Decision:** `apps/local/src/mcp.ts` is a dedicated stdio entry: Nest **application context** (no HTTP listener) + `@modelcontextprotocol/sdk` `StdioServerTransport`. Tool input schemas come straight from `@repo/mcp-contracts` (`schema.shape`). All logging goes to **stderr** via a custom logger.

**Rationale:** Reuses Nest DI/services without the HTTP layer. stdout belongs to the MCP protocol — Nest's default logger writes to stdout and corrupts the stream (observed during testing).

## 9. Plugin runs the MCP server via a committed self-contained bundle (option "D1")

**Context:** Options considered: (A) stdio spawn from monorepo sources (`${CLAUDE_PROJECT_DIR}` — works only in-repo), (B) long-running HTTP server the plugin points at, (C) stdio launcher that ensures the HTTP app, (D) bundling the app into the plugin — as JS bundle (D1), compiled binary (D2, ~60 MB/platform, needs release infra), or sources + first-run install (D3).

**Decision:** D1 — `turbo generate` runs `bun build --target bun` on `mcp.ts` → committed `plugins/claude-code/servers/noesis-local.js` (~3.6 MB). `.mcp.json` launches it with `bun ${CLAUDE_PLUGIN_ROOT}/servers/noesis-local.js`.

**Rationale:** Verified empirically: the bundle boots and serves from an empty directory with no `node_modules` (Nest's optional deps stay `--external`; Nest lazy-requires them in try/catch). Claude Code owns the process lifecycle. Requires bun on the target machine — acceptable, the toolchain is bun-first. Option B (HTTP) remains the natural extension when multiple harnesses should share one running server.

## 10. Server URL is configured via `NOESIS_SERVER_URL`

**Decision:** The MCP server's REST target is `NOESIS_SERVER_URL`, zod-validated at bootstrap (`z.url()`, default `http://localhost:3000`, fail-fast with exit 1 on garbage). `.mcp.json` uses `${NOESIS_SERVER_URL:-http://localhost:3000}` expansion.

**Rationale:** Developers pick the server through existing Claude Code layers — `.claude/settings.json` `env` (team default), `.claude/settings.local.json` (personal), shell env — with zero plugin changes. A runtime-switch tool persisting to `${CLAUDE_PLUGIN_DATA}` was considered and deferred until mid-session switching is a real need.

## 11. CI enforces that generated output is committed

**Decision:** GitHub Actions job: `bun install --frozen-lockfile` → `bun run generate` → fail if `git status --porcelain` is non-empty. Bun version pinned via `bun-version-file: package.json` (`packageManager`).

**Rationale:** The committed bundle/schemas must never drift from `apps/local` / `mcp-contracts` sources. `--porcelain` catches untracked new files, not just modifications. Pinning bun matters because bundle bytes may differ across bun versions (false drift). Determinism was verified (byte-identical output across runs) so the check cannot flap.

## 12. npm distribution; marketplace catalog inside the plugin folder

**Context:** Installing from a git marketplace clones the entire monorepo — unacceptable for plugin consumers. Alternatives: `git-subdir` source (sparse clone), npm publishing, or a mirrored standalone repo.

**Decision:** Publish the plugin as **`@noesis/claude-code-plugin`** (npm `source` in the marketplace). `marketplace.json` moved from the repo root to `plugins/claude-code/.claude-plugin/marketplace.json`; users add it by **direct raw URL**, which fetches one JSON file — no clone at any step.

**Consequences:**

- `files` whitelist ships exactly `.claude-plugin/plugin.json`, `.mcp.json`, `bin`, `servers`, `skills` (~755 kB tarball). Dotfiles must be listed explicitly — npm excludes them by default; CI checks tarball contents (`npm pack --dry-run`) for the critical files and rejects an accidentally-included `marketplace.json`.
- `@repo/mcp-contracts` moved to `devDependencies` — workspace deps don't resolve for npm consumers; the shipped artifacts are self-contained instead.
- `scripts/validate.ts` is bundled at generate time to committed `bin/validate.js` so installed copies can validate payloads (SKILL.md calls `bun "${CLAUDE_PLUGIN_ROOT}/bin/validate.js"`).
- Repo-form `/plugin marketplace add owner/repo` no longer works (nothing at the repo root) — by design; installs track published releases, not `main`.
- Releases require bumping the version in `package.json`, `plugin.json`, and `marketplace.json`, regenerating, and `npm publish`.
- The `@noesis` npm scope is a placeholder until first publish.

## 13. Plugin's model-facing vs. runtime-facing schema split

**Decision (cross-cutting, emerged from 4/6/9/12):** Each contract exists in three synchronized forms — zod source (`packages/mcp-contracts`), generated JSON Schema + example (skill references, for the model to read), and bundled runtime validators/tools (`bin/validate.js`, `servers/noesis-local.js`). `turbo generate` is the single command that synchronizes all of them; CI guards the sync.

**Rationale:** Models read JSON Schema cheaply without executing code; runtime code validates with the real schemas; humans edit exactly one zod definition.

## 14. De-bundled validator; npm scope; beta release channel

**Supersedes parts of 12/13.**

**Decision:**

- The payload validator is no longer bundled. `scripts/validate.ts` + `scripts/bundle-validator.ts` are gone; instead `bin/validate.ts` ships as plain TS and imports readable zod copies under `contracts/`, generated by `scripts/copy-contracts.ts` (rewrites the `@repo/shared-contracts` specifier to a relative path). `zod` is now a regular plugin `dependency`. SKILL.md calls `bun "${CLAUDE_PLUGIN_ROOT}/bin/validate.ts"`. The `servers/noesis-local.js` MCP server **stays bundled** (NestJS is too heavy to vendor as source).
- `files` whitelist now ships `.claude-plugin/plugin.json`, `.mcp.json`, `bin`, `contracts`, `servers`, `skills`. CI's tarball check asserts `bin/validate.ts`, `contracts/registry.ts`, `contracts/shared/index.ts`.
- Published scope is **`@noesis-vision/claude-code-plugin`** (the `@noesis` scope from 12 was unavailable). Releases go through `bun publish`, not `npm publish` — only bun rewrites `workspace:*`/`catalog:` in the packed manifest.
- A **beta channel** exists: `bun run publish:beta` publishes prerelease versions under the npm `beta` dist-tag, leaving `latest` untouched. The marketplace exposes it as a second plugin entry `noesis-beta` (npm source pinned to `version: "beta"`), so only opt-in testers receive prereleases.

**Consequences:**

- The committed `bin/validate.js` blob (~540 kB) is replaced by small readable TS; drift surface shrinks but is still CI-guarded.
- `tsconfig.json` `include` widened to `["scripts", "bin", "contracts"]` so the shipped entry point and generated copies are type-checked.

## 15. Tag-driven releases via npm trusted publishing; bundle built at pack time; version single-sourced

**Supersedes the release flow of 14 and the committed-bundle parts of 9/11.**

**Decision:**

- **Releases are tag-driven.** Pushing a `v*` tag runs `.github/workflows/release.yml`: full verify suite (tags don't trigger CI), generate-drift check, tag↔version assertion, then `bun run bundle` + `bun pm pack` (bun rewrites `workspace:*`/`catalog:`) and `npm publish <tarball>` via **npm trusted publishing** (OIDC, npm ≥ 11.5.1) — no token secret, provenance attached automatically. `bun publish` can't do this yet (oven-sh/bun#15601). The dist-tag is derived from the version: prerelease (`-` present) → `beta`, otherwise `latest` — removing the manual `publish:beta` footgun (the script remains as a local escape hatch). Prerequisites added: `license: MIT` (+ LICENSE file), `repository` with `directory` (provenance validation requires it), README (npm page was blank). _One-time setup: configure the trusted publisher on npmjs.com for `@noesis-vision/claude-code-plugin` → this repo + `release.yml`._
- **`servers/noesis-local.js` is no longer committed** (gitignored). Since npm is the only distribution channel (12), committing it only grew git history ~3.6 MB per regeneration with unreviewable diffs. It's built by `bun run bundle` — split out of `generate` — at pack time (`prepublishOnly`, release workflow) and by the tarball smoke test. The small readable generated artifacts (`contracts/`, skill references) stay committed and drift-checked.
- **`package.json` is the single version source.** `generate` stamps `.claude-plugin/plugin.json` from it (`scripts/stamp-plugin-version.ts`), so the CI drift check now also enforces version sync. `bun run bump` writes only `package.json` + the stable marketplace pin.
- **Smoke tests replace the CI tarball grep.** `bun test` (runs under `turbo test`): every contract's committed `example.json` must pass `bin/validate.ts`; the real tarball is packed and extracted, file whitelist and `workspace:`/`catalog:`-free manifest asserted, and the bundled MCP server is booted from the extracted tarball in an empty directory for an MCP initialize + `tools/list` handshake — decision 9's "boots from an empty dir" property is now verified on every CI run.

**Consequences:**

- Release flow: `bun run bump <ver>` → `bun run generate` → commit → `git tag v<ver>` → push tag. Each release has an anchor commit.
- A plain checkout no longer has a working MCP server bundle — run `bun run bundle` once (or `bun test`, which builds it).
- Known wart: npm's `latest` dist-tag currently points at `0.1.0-beta.1` (first publish always claims `latest`; it can only be moved, not removed). The first stable release fixes it.

## 16. Plugin folders follow documented Claude Code semantics; beta channel pinned to semver

**Supersedes the `bin/` location of 14 and the beta dist-tag pin of 14.** Triggered by checking the layout against the official plugin reference.

**Context:** The plugin docs assign meanings to folder names: `scripts/` = shipped hook/utility scripts invoked via `${CLAUDE_PLUGIN_ROOT}/scripts/...`; `bin/` = executables added to the Bash tool's PATH (invokable as bare commands while the plugin is enabled). Our `scripts/` held unshipped dev/build tooling, and `bin/validate.ts` sat in the PATH folder without using (or being usable by) its semantics. Separately, the marketplace npm source only documents exact-semver pins (`2.1.0`, `^2.0.0`) — the `noesis-beta` entry's `"version": "beta"` dist-tag pin relied on undocumented behavior.

**Decision:**

- Dev/build tooling moved `scripts/` → `tools/` (the standard JS-ecosystem alternative; stays unshipped). The validator moved `bin/validate.ts` → `scripts/validate.ts`, matching the docs' shipped-utility-script convention; `bin/` is gone. The MCP server bundle deliberately **stays** in `servers/` — the docs' own example location — and must not move to `bin/`: PATH exposure would let the model accidentally launch a long-running stdio server in a Bash call. `files` ships `scripts` instead of `bin`; the tarball test asserts `tools/` and `test/` do not leak into the package.
- `plugin.json` gained the recommended metadata fields (`author`, `homepage`, `repository`, `license`).
- The `noesis-beta` marketplace entry is pinned to an exact prerelease version. `bun run bump` advances the channel matching the bumped version's prerelease-ness: prerelease bumps advance prerelease-pinned entries, stable bumps advance stable-pinned ones. Testers get updates when the bumped `marketplace.json` lands on `main` (the catalog is fetched by raw URL), so nothing is lost versus the dist-tag pointer — except the reliance on undocumented behavior.

**Consequence:** A bare-command validator (`bin/noesis-validate` with shebang + exec bit on the Bash PATH) was considered and skipped — the validator is only invoked from SKILL.md, where an explicit `bun "${CLAUDE_PLUGIN_ROOT}/scripts/validate.ts"` is clearer.

## 17. Hosting: single Railway service; Nest serves the UI

**Status: implemented (see 18 for the route surfaces and implementation deltas).**

**Context:** `apps/server` (NestJS on bun) and `apps/ui` (Vite SPA) need hosting on a single platform. Options considered: Vercel (UI fits perfectly, but its serverless functions don't support NestJS — the bun runtime is beta and framework-limited — and the server's main consumers are MCP servers on developer machines hitting `NOESIS_SERVER_URL`, which want an always-on REST target); a Vercel-UI + Railway-server split (rejected: two platforms); Render (always-on tier costs more for the same); Fly.io (more hand-rolled ops). A serverless backend was explicitly evaluated and rejected: the planned **in-memory LadybugDB graph** (embedded, in-process, native bindings) is architecturally opposed to serverless — ephemeral instances lose the graph, horizontal fan-out diverges it, and native addons fight function packaging. An embedded in-memory database means the database _is_ the process, so the process must be long-running.

**Decision:** Deploy on **Railway** as **one service**: the NestJS server serves the built UI statically (`@nestjs/serve-static`, serving `apps/ui/dist` staged into the server's deploy). One URL, one deploy, no CORS; "serverless economics" available later via Railway app sleeping if idle cost matters.

**Consequences:**

- UI and server deploy together (acceptable at this stage); static assets are served by the app process, not a CDN.
- Splitting into two Railway services later (independent deploys/scaling) is a small change — only the serving location of `apps/ui/dist` moves; the apps stay separate in the repo either way.
- When LadybugDB lands: keep a single instance (single writer), persist via a Railway volume (on-disk Ladybug, or in-memory + checkpoint on `OnModuleDestroy` and on an interval, reload on boot).
- Implementation when picked up: `ServeStaticModule` in `apps/server` (path empty in dev), build step staging `apps/ui/dist`, Railway service config, README deploy notes.

## 18. Route surfaces by consumer; Dockerfile deploys via CI `railway up`

**Implements 17, with deltas. Supersedes the single `/api` global prefix (12-era `main.ts`).**

**Context:** Implementing 17 surfaced two things. First, serving the SPA and the REST API from one origin needs route prefixes that can't collide — and different consumers will need different auth. Second, the original `setGlobalPrefix('api')` had silently broken the MCP client, which fetched the server root (404); nothing caught it because no test exercised an MCP `tools/call` end to end.

**Decision:**

- **Routes are segregated by consumer, one Nest module per surface:** `/ui/*` (ui app; future session-style auth), `/api/*` (local app / MCP; future token auth), `/internal/*` (health and technical endpoints; must stay harmless while publicly reachable). Future auth is a per-module guard binding — never global.
- **Route constants live in the contracts packages** (`@repo/ui-contracts` → `uiRoutes`/`uiPath`, `@repo/local-contracts` → `apiRoutes`/`apiPath`); controllers, the ui fetch, and `ServerClientService` import them, so client/server drift is impossible. This fixed the MCP client 404 by construction.
- **SPA serving is opt-in via `UI_DIST_PATH`** (absolute-resolved; set in the container, unset in dev where Vite serves the ui and in tests). The three surfaces are excluded from the index.html fallback so their JSON 404s survive.
- **Deployment:** repo-root multi-stage `Dockerfile` (`oven/bun` pinned to `packageManager`; manifests-first install layer; `turbo build --filter=server --filter=ui`; slim runtime with only the two dist outputs, non-root). `railway.json` sets the Dockerfile builder, `/internal/health` healthcheck, and on-failure restarts. The `deploy` job in `ci.yml` runs `railway up --ci` on green main pushes only (needs `RAILWAY_TOKEN` secret + `RAILWAY_SERVICE` repo variable) — deltas from 17's sketch: Dockerfile instead of builder auto-detect, Actions-driven instead of Railway auto-deploy.
- **New test layers:** a full-stack MCP e2e (boots the server app, drives a real `tools/call` through `apps/local` — the test that would have caught the 404) and a black-box SPA-serving e2e (fixture `UI_DIST_PATH`, asserts fallback and surface 404 behavior).

**Consequences:**

- `@fastify/static` joined the server build externals (lazy-required by `@nestjs/serve-static`; unused on the Express adapter) — the decision 9 externals list grows with each Nest optional dep.
- The route move was breaking for old plugin builds; shipped before any server was deployed, so no consumer broke. A plugin beta release carries the client fix.
- `NOESIS_SERVER_URL` for plugin users is the Railway-generated service domain.

## 19. Java scanner: ArchUnit importer as the engine, Spoon for source fidelity

**Context:** The Java scanner (`scanners/java/`, see `scanners/java/design-doc.md` for the full research) must extract graph objects, behaviours, and relations from Java codebases and ship as both a Maven and a Gradle plugin. Candidates evaluated: ArchUnit's `ClassFileImporter` (bytecode, Apache 2.0, shaded single JAR, `@PublicAPI`-stable, proven standalone by Spring Modulith), jQAssistant (closest off-the-shelf code graph but **GPLv3** — embedding would infect the plugin license — and no official Gradle support), Spoon (source-based JDT metamodel, MIT option, exact positions/comments/parameter names, no-classpath mode, but slower and heavier), and roll-your-own ASM (maximal control, but re-implements what ArchUnit already solved). CodeQL was disqualified on license grounds.

**Decision:** Two-engine design inside `scanner-core`:

- **ArchUnit's importer is the primary engine** — it produces the graph (objects, behaviours, relations) from compiled bytecode.
- **Spoon provides the source-fidelity enrichment pass** — exact source positions, comments/Javadoc, and parameter names, merged into the graph as optional fields keyed by FQN + member descriptor. Spoon is chosen over JavaParser for this role because of its no-classpath mode (best-effort model without resolution failures) and the MIT license option.
- The engines stay invisible above `scanner-core`: the Maven Mojo and Gradle plugin (Worker API, isolated classloader) only gather inputs (class dirs, source roots, classpath) and invoke the core, per the OpenRewrite/SpotBugs three-artifact pattern.

**Rationale:** ArchUnit gives the best effort-to-coverage ratio — its metamodel maps ~1:1 onto the objects/behaviours/relations contract and its fully-shaded JAR avoids classpath conflicts inside build-tool plugins. Bytecode-only analysis loses comments, parameter names, and exact positions; Spoon fills exactly that gap without replacing the structurally complete bytecode graph.

**Consequences:**

- Scan binds after compilation (Maven post-`compile`, Gradle `dependsOn(classes)`); the Spoon pass needs source roots in addition to class dirs.
- The contract schema must model enrichment fields as **optional** (the Spoon pass may be skipped or partial) and must represent unresolved/ambiguous access targets explicitly (ArchUnit targets can resolve to 0..n members).
- Spoon's JDT dependency is unshaded — classloader isolation in the plugins is mandatory, not optional.
- Performance guardrails for large codebases: disable ArchUnit's classpath dependency resolution by default, scan module-by-module, stream JSON output.
- Remaining open questions tracked in design-doc §10: graph schema variant, relation derivation rules, multi-module aggregation, transport (file vs direct POST), Maven/Gradle coordinates.

## 20. Java scanner graph schema: typed DDD graph with messages and behaviour-level invocation

**Context:** The graph's purpose is visualizing system structure as DDD building blocks (tactical patterns plus hexagonal ports/adapters), detected via class annotations in ArchUnit's model (see `scanners/java/design-doc.md` §8–9). Three schema variants were evaluated: (A) generic property graph with open string vocabulary — flexible but contract-unsafe; (B) strongly-typed closed vocabulary as zod discriminated unions — the contract becomes the ubiquitous language; (C) layered architecture-over-code graph — drill-down capable but class-level payload volume on day one.

**Decision:** **Variant B, modified**, with three structural choices on top:

- **All communication is modeled as messages**: `Command`, `Query`, `Event` are first-class message nodes (annotated classes); communication edges (`SENDS`, `HANDLES`) point at messages, never block-to-block. One edge vocabulary for all three kinds — the message node's type distinguishes rendering.
- **Building blocks contain `Behaviour` nodes** (public methods, id = `fqn#method(paramTypes)`); an `ApplicationService` exposes its message handlers as behaviours with `HANDLES` edges. Invariants at ingest: commands and queries have exactly one handler (on an `ApplicationService`), events 0..n.
- **Invocation is behaviour-level**: `INVOKES` edges between behaviours replace block-level `USES`; block-to-block usage is derived server-side by lifting `INVOKES` through `CONTAINS`. Derived edges carry an optional `evidence: string[]` (borrowed from variant C) with source locations.

Full node/edge taxonomy and ArchUnit derivation rules in design-doc §9.4. Stereotype detection defaults to the **jMolecules** vocabulary (Apache-2.0) via a configurable annotation→stereotype mapping; `Query` has no jMolecules annotation and comes from the mapping (team annotation or a small `noesis-annotations` artifact).

**Rationale:** The typed contract rejects invalid graphs at ingest and gives the visualizer bespoke rendering per type without a side registry. Messages + behaviours capture _how the system communicates_ — the part of structure the visualization is for — at behaviour granularity (~5–10× block count), still orders of magnitude below variant C's class-level volume.

**Consequences:**

- Schema evolution is lock-step (zod contract + scanner + server ship together); new stereotypes are contract changes.
- The server owns derived views (block-to-block usage via `INVOKES` lifting) — the scanner ships facts, not aggregations.
- Custom team annotations must map onto the closed set via scanner config or they are dropped.
- Remaining open questions move to design-doc §10: `SENDS` derivation beyond constructor calls, ambiguous access targets in `INVOKES`, multi-module aggregation, transport, coordinates.

## 21. Primary toolchain owns the repo root; CI runs only what a push affects

**Context:** Two related questions. First, every push ran the full TS pipeline regardless of what changed, and the Java scanner (19, 20) had no CI job at all. Second, with a second language in the repo, should the turbo-managed workspace move under a subfolder (e.g. `ts/`) so the root holds no technology-specific files?

**Decision:**

- **Layout stays as-is: the dominant toolchain (bun/turbo workspace) owns the repo root; minority languages live in self-contained subtrees** (`scanners/java` with its own `pom.xml`, future `scanners/dotnet` likewise). Nesting the TS workspace under a subfolder was rejected: the JS ecosystem assumes workspace root = repo root, so the move costs permanent friction (`working-directory:` on every CI step, IDE/TS-server roots, Docker build context, the npm trusted-publisher workflow path) and still leaves `.github/`, `Dockerfile`, `railway.json` at root — the symmetry is never actually achieved. Revisit only if the repo becomes genuinely polyglot with no dominant language.
- **CI change detection is job-level, not workflow-level:** a `changes` job (`dorny/paths-filter`) exposes `java` and `ts` outputs; downstream jobs gate on them with `if:`. Per-workflow `paths:` filters were rejected because a path-skipped workflow leaves required status checks pending on PRs, while a skipped job satisfies them.
- **TS tasks run with `turbo run <task> --affected`** so a change rebuilds only the touched packages plus their dependents (turbo already owns the graph — no path lists to maintain per package). `TURBO_SCM_BASE` is the PR base branch, or `github.event.before` on main pushes, falling back to `HEAD^` after a force push; checkout uses `fetch-depth: 0`.
- **The Java scanner gets its own CI job** (`mvn verify`, Temurin 17 matching `maven.compiler.release`, maven cache), gated on `scanners/java/**`.
- **Format check becomes its own ungated job:** prettier covers `**/*.md`, so doc-only commits must still be checked even when both gated areas are skipped.
- **Deploy keys off the TS gate implicitly:** it `needs` the gated `verify`/`generate-check` jobs, so a java-only push to main skips deploy (the image contains only server + ui).

**Consequences:**

- `generate-check` still runs the full `bun run generate` (the task is `cache: false`) whenever any TS path changes — the staleness check stays whole-workspace.
- Branch protection should require `changes`, `format`, and the gated job names; skipped gated jobs count as passing.
- Workflow edits (`.github/workflows/ci.yml`) are in both filters, so CI changes exercise both pipelines.
- The release workflow (tag-triggered) is unchanged and still runs the full TS verify suite — tags must validate everything regardless of what the last push touched.

## 22. Remove Turborepo; pure bun workspace with `bun run --filter`

**Context:** Turbo's two value propositions — build caching and topological `^build` ordering — were unused in practice: every shared package exports TypeScript source (`"./src/index.ts"`, no `build` script), bun runs `.ts` natively, and no workspace consumes another's `dist`. Only the three apps build at all, independently. Meanwhile turbo cost a dependency, a config file, an eslint plugin, and CI machinery (`TURBO_SCM_BASE` resolution, `fetch-depth: 0`).

**Decision:** Remove Turborepo entirely. Root scripts become `bun run --filter '*' <task>` (which skips packages lacking the script and runs in workspace-dependency order in bun ≥ 1.3). Supersedes the turbo-specific parts of decision 21: CI's `verify` job drops `--affected` and runs all TS tasks on every gated push (**run-all**); the job-level java/ts gating via `dorny/paths-filter` stays. Per-package path filters were rejected — they'd reintroduce by hand the dependency-graph maintenance turbo provided for free. The `eslint-plugin-turbo` `no-undeclared-env-vars` rule is dropped without replacement; `turbo.json`'s `globalEnv` needed no new home (apps read `process.env` directly — it was only a cache-key declaration). Full inventory and steps: `docs/work/chores/turbo-to-bun-migration.md`.

**Rationale:** One less tool with zero lost correctness — turbo's ordering was never load-bearing here. Matches the "primary toolchain owns the repo root" principle (21) more honestly: the toolchain is bun, full stop.

**Consequences:**

- CI runs the whole TS suite on every gated push. Acceptable at ~10 small packages; revisit selective execution (or turbo) if verify times grow painful.
- No local build cache; real build work is only the 3 apps.
- `bun run dev` loses turbo's TUI multiplexing — output is interleaved plain logs.
- A root `ci` script (`lint && check-types && test && test:e2e && build`) mirrors the CI verify job for local pre-push runs.

## 23. lbug QueryResults are closed eagerly; never left to the GC

**Context:** `bun test` in `apps/server` segfaulted (`Segmentation fault at address 0x8`). Bisection isolated the mechanism: an lbug `QueryResult` holds a native handle, and if the object is left to the garbage collector and its finalizer runs **after** the parent `Database` was closed, the native finalizer touches freed kuzu state — use-after-free. The crash was GC-timing dependent (deterministic in the specs only because Nest `Logger` churn triggers GC reliably). Explicitly closing results fixed it in 5/5 runs; closing only the `Connection` did not (0/5).

**Decision:** `DatabaseService.query()` closes every `QueryResult` in a `finally` after row extraction (rows are already materialized by `getAllSync`), and `onModuleDestroy` closes the `Connection` before the `Database` (proper teardown order, though not the crash trigger). **Convention: all lbug access goes through `DatabaseService.query()`** — raw `getConnection().query(...)` callers would reintroduce the leak; the lifecycle spec was converted accordingly. `PreparedStatement` has no close API and is safe to leave to the GC.

**Consequences:**

- The shared-fixture rationale in `testing/test-db.ts` (one DB per test process) still stands — multi-instance pressure remains an independent lbug limitation.
- `query()` returns fully materialized rows only; code must not expect to stream rows from a held `QueryResult` later.
- If a streaming API is ever needed, it must own explicit close semantics (e.g. a callback-scoped variant), not hand out raw results.

## 24. Native modules are externals: lbug ships as node_modules in the image

**Context:** The Railway deploy failed its healthcheck after the SDLC migration added lbug to the server. `bun build` cannot bundle a native `.node` binding — it inlined lbug's JS wrapper with the **build machine's absolute install path** baked into the dlopen call, which doesn't exist in the runtime image (decision 17's slim stage copies only `dist`). The server crashed at `DatabaseModule` init. A second latent issue surfaced right after: the default `NOESIS_DATA_DIR` (`.data`) landed in root-owned `/app` while the container runs as `USER bun` → `EACCES`.

**Decision:** The server bundle marks `lbug` `--external`; the Dockerfile stages a minimal runtime copy (JS wrapper + `lbugjs.node` + `package.json`, ~17 MB of the ~500 MB installed package, from the version-agnostic `apps/server/node_modules/lbug` workspace symlink) into `/app/node_modules/lbug`, where `require("lbug")` from `/app/server/main.js` resolves naturally. `NOESIS_DATA_DIR=/data` with a Railway volume (`noesis-server-volume`) mounted there for persistence. Railway mounts volumes **root-owned**, shadowing any image-time chown — so instead of a `USER bun` directive, CMD starts as root, chowns `/data`, and drops to bun via `setpriv` (present in `oven/bun-slim`). Verified locally: `docker run` against a deliberately root-owned volume → `/internal/health` 200, process running as uid 1000, DB files on the volume owned by bun.

**Consequences:**

- "Bundled, self-contained server" (17) now reads: self-contained **except native modules**, which ship as real `node_modules` entries. Any future native dep follows the same pattern (external + staged copy).
- The container has no `USER` directive; non-root is enforced by the `setpriv` drop in CMD. Anyone overriding CMD must drop privileges themselves.
- The staged file list is explicit; if an lbug upgrade adds a runtime file, the container boot (healthcheck) is the guard.

## 25. Biome replaces ESLint + Prettier for code; Prettier stays for Markdown only

**Context:** Linting/formatting spanned two tools and a config package: `@repo/eslint-config` (flat configs `base`/`nest`/`vite-react`, typed linting in the Nest apps via `typescript-eslint`, `eslint-plugin-prettier`, `only-warn` + `--max-warnings 0`) plus root Prettier for `**/*.{ts,tsx,md}`. That's 8 lint-related dependencies, per-app configs and lint scripts, and two tools that had to agree on style.

**Decision:** Migrate to Biome 2 (`biome check`) for all code linting **and** formatting — one root `biome.json`, no per-package configs or lint scripts (root `lint` is `biome check .` directly, no longer a `--filter '*'` fan-out). Biome has no Markdown support, so Prettier stays as a root-only dev dependency scoped to `**/*.md` — the ungated CI `format` job keeps checking doc-only commits (decision 21). Rule mapping: Biome recommended preset ≈ eslint+tseslint recommended; `noExplicitAny` off in the Nest apps (as before); `@typescript-eslint/no-floating-promises` → nursery `noFloatingPromises` (Biome's own type inference, no tsc) as `error` in the Nest apps; react-hooks rules → Biome's react domain (auto-enabled); `react-refresh/only-export-components` → `useComponentExportOnlyModules` in `apps/ui`. NestJS parameter decorators need `unsafeParameterDecoratorsEnabled: true` (without it Biome mis-parses `@Inject()` constructor params). Generated output (`plugins/claude-code/contracts/`, `plugins/claude-code/skills/**/references/` — both `JSON.stringify`-emitted) and `apps/ui/public/` assets are excluded from Biome.

**Rationale:** One tool, one config, ~50× faster, no eslint-vs-prettier coordination. The `only-warn` + `--max-warnings 0` dance (everything is a warning, any warning fails) collapses into Biome's default semantics: errors fail, and `biome check` also verifies formatting and import organization.

**Consequences:**

- Typed linting is weaker than `recommendedTypeChecked`: Biome's type inference backs `noFloatingPromises`, but rules like `no-unsafe-argument` have no equivalent. Accepted — tsc (`check-types`) still gates type errors.
- `biome check` organizes imports (assist); import order is now enforced, autofixed via `lint:fix`/`format`.
- Prettier's scope shrank to Markdown; `.prettierrc`/`.prettierignore` remain for that.
- Editor integration is the Biome plugin (IntelliJ/VS Code), not ESLint + Prettier plugins.

## 26. Pre-commit hook via `core.hooksPath`; no hook manager

**Context:** With Biome making staged checks near-instant (decision 25), a local pre-commit guard became worth its cost. Husky and lefthook were considered; modern husky is essentially `git config core.hooksPath` plus a shim, and with two one-line checks there is nothing for lefthook's parallelism to win.

**Decision:** A committed `.githooks/pre-commit` runs `biome check --staged --no-errors-on-unmatched` plus `prettier --check` on staged `*.md` — exactly mirroring CI's lint and format jobs, scoped to the commit. It is activated per clone by the root `prepare` script (`git config core.hooksPath .githooks || true`), which `bun install` runs automatically. The `|| true` keeps `bun install` working where there is no repo — the Docker build excludes `.git` via `.dockerignore`.

**Consequences:**

- Heavier checks (`check-types`, tests, e2e, build) are deliberately **not** hooked — pre-commit stays sub-second; CI and `bun run ci` remain the real gate.
- `git commit -n` bypasses the hook for work-in-progress commits.
- New clones get the hook on first `bun install`; nobody has to install or configure anything.

## 27. Dockerfile lives in `apps/server/`, not the repo root

**Context:** The Dockerfile builds the server image (decision 17/18), yet sat at the repo root among workspace-wide config, purely because that's Docker's default lookup path. Root files should be things that genuinely govern the whole repo.

**Decision:** Move it to `apps/server/Dockerfile` — next to the app it builds. `railway.json` stays at root (Railway reads it from the service root) with `dockerfilePath: "apps/server/Dockerfile"`. The **build context remains the repo root**, so `COPY` paths and the root `.dockerignore` are unchanged; locally the build is `docker build -f apps/server/Dockerfile .`. The CI `ts` paths filter drops its explicit `Dockerfile` entry — `apps/**` now covers it.

**Consequences:**

- Anyone building locally must pass `-f apps/server/Dockerfile`; a bare `docker build .` no longer finds it.
- If a second deployable image ever appears (e.g. `local`), it follows the same pattern: `apps/<app>/Dockerfile`, shared root context.

## 28. Hono replaces NestJS; bun replaces Vite; typed RPC client

**Context:** The server used almost none of Nest's machinery (3 controllers, one `@Get` each, no guards/pipes/interceptors), yet paid for all of it: DI/decorator ceremony, Express + rxjs + reflect-metadata at runtime, 6 of the 7 `--external` bundling flags, and `TestingModule` + supertest in tests. The ui app carried Vite for a plain React SPA with no SSR planned. Full plan: `docs/work/chores/nest-to-hono-bun-migration.md`; wiring modeled on the `first-app` reference project.

**Decision:** `apps/server` is a [Hono](https://hono.dev/) app on `Bun.serve` with an explicit composition root (`main.ts` constructs services, wires `createApp(deps)`, owns DB lifecycle incl. `SIGTERM`/`SIGINT` close — decision 23); surfaces are factory functions taking narrow deps interfaces. `apps/ui` is bundled by bun: `src/dev-server.ts` (dev-only `Bun.serve` with HMR, proxying `/ui/*` to `:3000` — same-origin like prod; a CLI-only `bun ./index.html` dev server was rejected because it cannot proxy) and `build.ts` (`Bun.build` → `dist/`, copying `public/` verbatim since bun has no public-dir convention). The ui calls the server through `hc<AppType>`: `server` exposes a **type-only** `./client` exports entry, and `ui` devDepends on `server` for it. `@repo/ui-contracts` route constants lost their consumer (retiring the package is a follow-up); the `/api` surface keeps `@repo/local-contracts` constants so it cannot drift from the unchanged `apps/local`. `@hono/zod-validator` arrives with the first validated route.

**Consequences:**

- The server bundles with a single external (`lbug`, decision 24 — which is also why the server keeps its `bun build` step instead of first-app's run-from-source: the minimal-lbug image staging needs a bundle). Dockerfile runtime stage unchanged.
- Adding `"type": "module"` to `server` made NodeNext enforce explicit `.js` extensions in relative imports — specs updated to match src convention.
- SPA parity subtleties, pinned by `test/static-ui.e2e.spec.ts`: hono's `serveStatic` honors absolute paths only in `root` (a leading `/` in `path` is stripped), and the SPA fallback excludes `/ui|/api|/internal` so surface 404s stay JSON-able.
- Portability rules keeping the Vite exit open: no `bun:` imports/Bun APIs/import attributes under `apps/ui/src` except `dev-server.ts`; HTML imports confined to `dev-server.ts` + `build.ts`; client-visible env only via `BUN_PUBLIC_*` behind one module; ui imports only **types** from `server` (Biome `useImportType` is now active for `apps/server` too — the decorator-era override is scoped to `apps/local`).
- Supersedes decision 17's "Nest serves the UI" wording (single-service hosting stands) and decision 7/README's decorator-duplication warning for the server (now `apps/local`-only). `nest.json` tsconfig preset remains for `apps/local`.

## 29. UI toolchain back to Vite; Hono + `hc` stay

**Context:** Decision 28 moved the ui app onto Bun's fullstack dev server + `Bun.build`. It worked, but the trade was re-evaluated after living with it: Bun's frontend toolchain is the least mature corner of the stack (no `public/`-dir convention, every `<link href>` must be bundler-resolvable, no plugin hooks comparable to Vite's), while the actual win over Vite was small — the dev-process count was identical and the proxy just moved from config into a script.

**Decision:** Revert the ui app's toolchain to Vite (`vite` dev server with the `/ui` proxy, `tsc --noEmit && vite build`), exactly via the exit hatch decision 28 reserved: `dev-server.ts`, `build.ts`, and `bun-env.d.ts` are deleted; `vite.config.ts` and the root `index.html` return; `favicon.svg` moves back to `public/`. Everything else from decision 28 stands — Hono server, composition root, type-only `hc<AppType>` client (`server/client`), single ui tsconfig (the 3-file project-reference split is not restored), and the ui-imports-only-types-from-server rule. The "no Bun APIs in ui src" portability rule is now enforced by the toolchain itself.

**Consequences:**

- The exit hatch worked as designed: the React tree, `src/client.ts`, and the server were untouched; only toolchain files changed. The reverse door (back to Bun fullstack) remains equally cheap and is documented in `docs/work/chores/nest-to-hono-bun-migration.md`.
- Tailwind, when adopted, uses `@tailwindcss/vite` instead of `bun-plugin-tailwind`.
- `bun ./index.html`-era caveats in the chore doc's execution notes are historical; Vite's `public/` convention again serves `/favicon.svg` and `/icons.svg` verbatim.

## 30. Config sweep: lib layering fixed, catalog for shared runtime deps, `exact` dropped, `ui-contracts` retired

**Context:** An external-style review of the workspace config surfaced leftovers the recent migrations didn't sweep up: `base.json` shipped DOM libs to every consumer (so the _server_ type-checked against `document`/`window` while the vite preset stripped DOM and the ui added it back — inverted layering); `zod` was hand-synced across five manifests and `hono` across two (the `hc<AppType>` typed client relies on ui and server resolving compatible hono types, so independent ranges are a real drift risk, not just untidiness); `bunfig.toml`'s `exact = true` was a copied default, not a decision, and contradicted the all-`^` manifests; `@repo/typescript-config`'s manifest was `private: true` yet carried `license: MIT` + `publishConfig.access: public` (create-turbo fossil); `apps/server/tsconfig.json` kept `outDir`/`baseUrl` although the server never emits via tsc; and `@repo/ui-contracts` had lost its last consumer in decision 28.

**Decision:** Fix the lib layering (`base.json` → `["ES2022"]` only; `vite.json` owns `DOM`/`DOM.Iterable`; the ui tsconfig drops its `lib` override). Move `zod` and `hono` into the root catalog (`"catalog:"` everywhere; bun's pack pipeline already rewrites catalog specifiers for the published plugin, decision 14). Remove `exact = true` — the standard combo is `^`ranges + `bun.lock` (frozen in CI). Strip the typescript-config manifest to name/version/private and the server tsconfig to bare `extends`. Delete `packages/ui-contracts` (Dockerfile manifest COPY and README updated); the server↔ui boundary is typed by `hc<AppType>` alone.

**Consequences:**

- A stray DOM global in server/package code is now a type error; browser types are opt-in per app type.
- Single-consumer deps (react, vite, MCP SDK, lbug) deliberately stay inline in their app manifests — the catalog holds only deps that must stay in lock-step across workspaces.
- `apiRoutes` in `@repo/local-contracts` remains the only hand-written route-constants package; if the `/api` surface ever moves to `hc` the same retirement applies to it.

## 31. `apps/local` off NestJS: plain-TS stdio MCP bridge

**Supersedes the Nest parts of 8; retires the decision 7 workaround and `nest.json`.**

**Context:** Decision 28 removed Nest from the server because it used none of the machinery it paid for. That argument applied more strongly to `local`: its entire Nest usage was DI for two providers plus an untouched `AppModule` hello-world HTTP scaffold nobody called, while it paid the decision 7 inline-decorator-flags wart, the `nest.json` preset with `strict: false`, two Biome rule exemptions, four bundle externals, and ~2.5 MB of Nest/Express/rxjs in the plugin's MCP bundle. The app's actual job (confirmed): a local stdio MCP server bridging a coding agent to the server's `/api` REST surface.

**Decision:** Rewrite `apps/local` as plain TypeScript on bun, mirroring the server's composition-root pattern: `src/main.ts` (entry; wires `loadConfig()` → `ServerClient` → `createMcpServer()` → `StdioServerTransport`), `src/server-client.ts` (plain class, was `ServerClientService`), `src/config.ts` (unchanged), `src/mcp-server.ts` (tool registration factory). The vestigial HTTP app is deleted outright, not ported. `local` adopts `"type": "module"`, `base.json` full strictness, and the server's test layout (`test/unit` + `test/e2e`; the full-stack MCP e2e from decision 18 moved unchanged apart from the entry path). Deleted with it: `nest-cli.json`, `tsconfig.build.json`, `@repo/typescript-config/nest.json`, the `apps/local` Biome override (`useImportType`/`noExplicitAny`), and all Nest/rxjs/reflect-metadata/supertest dependencies. `bundle-server.ts` and the app build lose their `--external` lists — the bundle is fully self-contained again.

**Consequences:**

- The plugin's `servers/noesis-local.js` shrinks ~3.6 MB → ~1.1 MB, and decision 9's "externals list grows with each Nest optional dep" problem is gone.
- Decision 7 (bun doesn't resolve package-specifier tsconfig `extends`) is now fully historical — no workspace uses decorators; `unsafeParameterDecoratorsEnabled` is removed from `biome.json` too.
- The MCP entry is now `src/main.ts` (was `src/mcp.ts`) — the app _is_ the MCP server, so the main-entry convention matches server/ui.
- Test-layout convention is now uniform: apps use `test/unit` + `test/e2e`; contract packages co-locate specs in `src/`.

## 32. CI/release hardening: SHA-pinned actions, one verify definition, Dockerfile bun-version guard

**Context:** Three review findings on the workflows. First, third-party actions were pinned by tag — a mutable reference the action owner (or an attacker who compromises the action repo) can retarget. That matters most where credentials live: `release.yml` holds `id-token: write` (npm trusted publishing — a compromised action publishes as us, with provenance), and `ci.yml`'s deploy job holds `RAILWAY_TOKEN`; since a compromised `checkout` runs in every job, both workflows carry the exposure. `npm install -g npm@latest` was similarly unpinned. Second, the release verify block hand-duplicated the root `ci` script's five commands — two definitions of "verified" that can drift. Third, the bun version lives in three places (`packageManager` plus the Dockerfile's two `FROM` tags) guarded only by a comment, while bundle-byte determinism explicitly depends on the bun version (decision 11).

**Decision:**

- **All actions in both workflows are pinned to full commit SHAs**, with the tag they correspond to in a trailing comment. Bumping means editing the SHA and comment together; there is no update automation yet (Renovate/Dependabot is the natural follow-up if churn gets annoying).
- **npm is pinned to its major** (`npm@11`; trusted publishing needs ≥ 11.5.1).
- **The release Verify step is `bun run format:check && bun run ci`** — the definition of "verified" lives once, in the root `package.json`, shared by local pre-push runs (decision 22) and the release gate. `ci.yml`'s verify job deliberately keeps split steps (Lint / Type-check / Test / …): per-step names and timings are worth the nominal duplication there, and the steps invoke the same root scripts.
- **`ci.yml`'s verify job greps the Dockerfile's `FROM oven/bun` tags against `packageManager`** (jq is present on GitHub runners) — version drift becomes a red build instead of a silent image/toolchain mismatch, the same treatment generated artifacts got in decision 11.

**Consequences:**

- Action bumps are deliberate, reviewable SHA edits; the tag comment is documentation only — the SHA is what runs.
- A bun upgrade now touches `package.json` and both Dockerfile `FROM` tags in one commit, enforced by CI.
- The drift guard lives in `verify` (gated on ts changes), which `apps/**` covers — a Dockerfile-only edit still triggers it.

## 33. The MCP bridge is its own npm package; plugins launch it via `bunx`

**Context:** More agent plugins are planned beyond Claude Code (OpenCode, Codex, ...), and all of them need the same stdio MCP bridge. Under the decision 31 setup the bridge lived in `apps/local` and was bundled into the Claude Code plugin at pack time (`servers/noesis-local.js`); repeating that per plugin means N copies of the same ~1.1 MB artifact and a drift risk between plugins that release independently. Three options were weighed: (1) publish the bridge as its own npm package and have every plugin invoke it at runtime, (2) keep pack-time bundling with shared tooling producing one bundle per plugin, (3) one multi-host distribution package containing the bridge plus every host's adapter files.

**Decision:** Option 1 — the standard MCP distribution pattern (`npx`/`bunx` a published server package). `apps/local` moves to `packages/mcp-bridge`, published as **`@noesis-vision/mcp-bridge`**: a `bin` pointing at `dist/main.js`, a fully self-contained bundle built at publish time (`prepublishOnly` → `bun build --target bun --banner '#!/usr/bin/env bun'`), shipping only that one file — workspace deps never leak into the published manifest, and exact-pinned `bunx` installs are cached after first run. The plugin's `.mcp.json` becomes `"command": "bunx", "args": ["@noesis-vision/mcp-bridge@<version>"]`; `bundle-server.ts` and the `servers/` bundle are deleted. Versioning is a **single version train**: `bump-version.ts` bumps plugin + bridge together, `generate` stamps the `.mcp.json` pin from the plugin's `package.json` (alongside `plugin.json`), the tarball test asserts pin/manifest consistency, and `release.yml` verifies the tag against both manifests and publishes both packages — bridge first, so the plugin's pin always resolves. Future plugins reference the same published bin from their own config format.

**Consequences:**

- New plugins are thin (skills + config); none carries a bridge copy, and all hosts on the same release run byte-identical bridge code.
- First launch per machine needs network to fetch the pinned version (subsequent launches hit the bunx cache) — the price of giving up the fully self-contained plugin tarball. `bun`/`bunx` remains the only runtime requirement; a node-compatible build (`--target node`, `npx`) is a possible follow-up if a host can't assume bun.
- Releasing the plugin always releases the bridge at the same version, even when only one changed — accepted at this scale for one definition of "released".
- npm trusted publishing must be configured for `@noesis-vision/mcp-bridge` (same repo + workflow) before the next release; until that release, the committed pin (`0.1.0-beta.2`) names a not-yet-published bridge version — harmless, since installed plugin 0.1.0-beta.2 tarballs still carry the old bundled server, and the next tag publishes both.
- The bridge keeps its full-stack e2e (now under `packages/mcp-bridge/test/e2e`); the plugin's tarball smoke test boots the workspace-built `dist/main.js` — the exact artifact `prepublishOnly` publishes — instead of a tarball-internal bundle.
- Bundle-byte determinism across bun versions (decisions 11/32) stops mattering for drift checks: the bundle is built only at publish time inside the release workflow, never committed or diffed. The Dockerfile bun-version guard (decision 32) is unaffected.

## 34. Validation moves into the MCP bridge; the plugin ships references only

**Context:** The plugin shipped the contracts three ways: `skills/prepare-mcp-data/references/*.schema.json` (generated JSON Schema + examples the model reads), `contracts/` (readable zod copies with rewritten imports, maintained by `tools/copy-contracts.ts`), and `scripts/validate.ts` (a zod validator over those copies, which the skill told the model to run before every tool call). Three shipped representations of one contract is drift surface, and pre-call validation in the plugin is the wrong layer anyway: it only works if the model remembers to run it, other agent plugins (OpenCode, Codex, ...) would each need their own copy, and the MCP SDK's built-in input validation rejects bad payloads with a protocol-level `InvalidParams` error carrying a raw zod issue dump — the MCP spec's guidance is that tool-level failures belong in-band (`isError` results) precisely so the calling model can read them and self-correct.

**Decision:** Validation moves into the MCP bridge; the plugin becomes pure content (skills + `.mcp.json`, no scripts, no runtime dependencies). `createMcpServer` drops `McpServer.registerTool` (whose schema hook triggers the SDK's own pre-handler validation) for the low-level `Server` API with explicit `tools/list` + `tools/call` handlers driven by a tool→contract table: `tools/list` advertises the JSON Schema generated from each tool's contract via `toJsonSchema` (byte-identical to the skill references), and `tools/call` runs `schema.safeParse` itself, answering schema violations with an in-band `isError` result containing the failing contract's name, `z.prettifyError` per-field issues, and the contract's canonical example — followed by an instruction to correct the payload and retry. Unknown tools get the same treatment (available tools listed). Deleted from the plugin: `contracts/`, `tools/copy-contracts.ts`, `scripts/validate.ts`, its smoke test, the ajv/zod dependency, and the Biome exclusion; the skill's "validate before calling" step becomes "call — the tool tells you what to fix". `bun run generate` is now references + version stamps only.

**Consequences:**

- Every agent host gets identical validation for free — it rides the bridge (decision 33), not each plugin; the zod schemas in `@repo/mcp-contracts` stay the single runtime source of truth, refinements included.
- A malformed payload costs one tool-call round trip instead of a pre-flight script run; the error text is designed for model self-correction (field issues + valid example), pinned by an in-memory-transport spec (`mcp-server.spec.ts`) asserting schema violations never surface as protocol errors.
- The advertised `tools/list` input schema and the skill's reference schema are generated from the same `toJsonSchema` call and cannot drift.
- New tools must route through the tool→contract table; there is deliberately no way to register a tool without a contract.
- zod parse semantics apply at the boundary: unknown keys are stripped, not rejected (the advertised JSON Schema still says `additionalProperties: false`, so honest clients see the strict contract).

## 35. LadybugDB moves to `@ladybugdb/core` 0.18.0 (prebuilt binaries); 0.14-era segfault workarounds verified obsolete

**Context:** The server pinned `lbug@0.14.3`, but that package is dead — last publish January 2026. LadybugDB's official npm home is now `@ladybugdb/core` (0.18.0), API-compatible (`Database`/`Connection`/`LbugValue`, `prepare`/`execute`, `getAllSync`), shipping prebuilt per-platform binaries as optional sub-packages (`@ladybugdb/core-{platform}-{arch}`) that its install script copies into the package dir — no cmake source build, ~19 MB installed vs ~500 MB. The two documented 0.14.3 crashes were re-tested against 0.18.0: (a) decision 23's use-after-free — 200 deliberately unclosed `QueryResult`s, `Database` closed, GC forced 10×: no segfault in 5/5 runs; (b) the test-db.ts multi-instance limit — 30 sequential + 10 concurrently open `Database` instances in one process: no segfault. Storage compatibility was verified directly: a database written by 0.14.3 (storage version 40) opens and reads correctly under 0.18.0 (storage version 42), so the Railway volume survives the upgrade in place.

**Decision:** Swap `lbug` → `@ladybugdb/core@^0.18.0` (dependency, `trustedDependencies` — the install script must run to place the platform binary — and the bundle's `--external`). The Dockerfile's hand-maintained staged file list (decision 24) is replaced by copying the whole self-contained package directory. The eager `QueryResult.close()` in `DatabaseService.query()` and the close-before-Database teardown order **stay** — no longer crash-critical, but deterministic native-handle release is the right hygiene and costs nothing. The shared test fixture (one DB per test process) also stays, now justified by speed rather than the fixed multi-instance crash; comments at all these sites were updated to mark the segfault rationale as historical (0.14.3).

**Consequences:**

- Storage upgrade is one-way: once 0.18.0 opens the production volume it may migrate it (40 → 42); rolling the image back to a 0.14.3 build after that is not safe. Take a volume snapshot before the first deploy if rollback matters.
- The runtime image stages `node_modules/@ladybugdb/core` wholesale — an upstream file-layout change can no longer silently drop a needed file (decision 24's healthcheck guard remains the backstop).
- `apache-arrow` is declared as a dependency upstream but never `require`d on our code paths, so it is deliberately not staged into the runtime image; if an upgrade starts importing it, container boot fails visibly.
- The convention that all lbug access goes through `DatabaseService.query()` (decision 23) is retained as an interface discipline, not a crash workaround.

## 36. Dockerfile manifest COPY uses `COPY --parents` globs instead of a hand-maintained list

**Context:** The build stage copied each workspace's `package.json` with an explicit `COPY` line per workspace so the `bun install` layer caches across source changes. That list duplicated `workspaces.packages` from the root `package.json` and had to be edited by hand whenever a workspace was added, moved, or removed — it already broke once when `apps/local` moved to `packages/mcp-bridge` (fixed in f2b1ff8), failing only at image build time on Railway, not in local dev or CI type-checks. Alternatives considered: a manifest-prune stage (`COPY . .` + `find -delete`, then `COPY --from`) — stable syntax but an extra stage that re-runs on every source change and reads as a trick; dropping manifest layering for a `RUN --mount=type=cache` install cache — simplest file but trades dependable layer cache for Railway's less reliable cache-mount persistence; `turbo prune --docker` — adopting a build orchestrator to fix a COPY list is disproportionate.

**Decision:** Use BuildKit's `COPY --parents` with globs that mirror the workspace declaration: `COPY --parents apps/*/package.json packages/*/package.json plugins/*/package.json ./`. Unlike classic `COPY` (which flattens glob matches into the destination), `--parents` preserves each match's directory path, reproducing the exact layout the hand-maintained list built. The flag lives in the labs channel of the Dockerfile frontend, so the file's first line is now the parser directive `# syntax=docker/dockerfile:1-labs` — it must precede every comment and instruction or Docker silently treats it as a plain comment. Railway builds with BuildKit and fetches the declared frontend, so nothing Railway-side changes.

**Consequences:**

- Adding, moving, or removing a workspace no longer touches the Dockerfile, as long as it stays under the `apps/*`/`packages/*`/`plugins/*` globs. Changing `workspaces.packages` itself (new top-level dir, nested globs) still requires updating the `COPY --parents` line to match — the globs are the one remaining duplication.
- The build now depends on the `docker/dockerfile:1-labs` frontend image (pulled by BuildKit at build time). `--parents` has been in labs since 1.7 (early 2024) and is behaviorally stable; if it graduates to the mainline `dockerfile:1` frontend, the directive can be dropped.
- Layer caching semantics are unchanged: the install layer still keys on manifest content only.

## 37. Dependency updates are automated with Renovate

**Context:** The repo had no mechanism for keeping dependencies current: `bun outdated` is a report, not a gate (it exits 0 regardless and tests the registry's state, not the commit), so wiring it into the PR pipeline would make green commits turn red on upstream releases. Four options were weighed: (1) a scheduled workflow running `bun outdated` into the job summary — visibility only, every update still manual; (2) Dependabot — GA bun support since February 2025, but it does not understand the `catalog:` protocol (dependabot-core #14320: catalog versions not checked; #12522: the `catalog` block stripped from `package.json` in an update PR), which disqualifies it here since the root plus 7 workspace manifests resolve through `workspaces.catalog`, and its security updates don't cover bun either; (3) Renovate via the hosted Mend app — bun workspace support plus managers for the SHA-pinned GitHub Actions (updates pin and `# vN` comment together), the Maven scanner, and Dockerfile `FROM` tags; bun _catalog_ extraction, however, is not yet shipped either — it exists only as an open upstream PR (renovatebot/renovate#42909; an earlier attempt, #39251, was closed unmerged), a gap confirmed after installation when the Dependency Dashboard detected every workspace dependency but none of the `workspaces.catalog` entries; (4) the community `catalog-update-action` — fills exactly the catalog gap but is a single-maintainer project. Renovate still strictly dominates Dependabot here (same catalog blind spot, but workspace detection works, coverage is broader, and — unlike Dependabot, which mangles the catalog block — it leaves the catalog untouched), so the catalog gap changes the coverage, not the choice.

**Decision:** Option 3 — the hosted Mend Renovate GitHub App, configured by a committed `renovate.json`: `config:recommended` as the base, a weekly Monday schedule, and `minimumReleaseAge` of 3 days so freshly published versions (the window where malicious releases are usually caught and yanked) are never proposed. `ignorePaths` excludes `apps/ui/docs/**` — the vendored react-flow examples carry ~25 `package.json` files that must not generate PRs. Three grouping rules: all GitHub Actions bumps in one PR, all Maven bumps in one PR, and `bun` + `oven/bun` grouped as "Bun runtime" because the decision 32 CI guard requires `packageManager` and the Dockerfile `FROM` tags to move in the same commit. No automerge: every update is a normal reviewed PR validated by the existing `verify`/`generate-check` jobs, and merging one deploys like any other change.

**Consequences:**

- Renovate runs entirely on Mend's infrastructure with read/write repo access (branches + PRs) — the one trust trade-off of the hosted app over self-hosting. Nothing executes in this repo's CI beyond the normal checks on its PRs.
- The config is inert until the Mend Renovate app is installed on the repo (GitHub Marketplace, manual step). Because `renovate.json` already exists, Renovate skips its onboarding PR and starts from this config.
- The 7 `workspaces.catalog` entries (hono, zod, typescript, `@biomejs/biome`, prettier, `@types/bun`, `@types/node`) are invisible to Renovate until renovatebot/renovate#42909 merges — they stay manually updated (`bun outdated` / `bun update`). Workarounds were considered and rejected for now: a JSONata custom manager can propose catalog bumps but cannot regenerate `bun.lock` on the hosted app, so every such PR would arrive red on `--frozen-lockfile`; de-cataloging the deps defeats decision-level version centralization. Revisit when the upstream PR lands.
- If Renovate cannot bump the `packageManager` bun version itself, a "Bun runtime" PR may arrive with only the Dockerfile tags changed — the decision 32 drift guard then fails that PR visibly, and the fix is a manual `packageManager` bump on the Renovate branch.
- The Dependency Dashboard issue lists pending updates between weekly runs; checkboxes there trigger PRs on demand, so the weekly cadence is a rate limit, not a hard delay.

## 38. `@repo/mcp-contracts` merges into the bridge, which now generates plugin references

**Context:** After decision 34 moved payload validation into the MCP bridge, `@repo/mcp-contracts` had exactly two consumers: the bridge itself (`mcp-server.ts` validates against the zod registry and advertises its JSON Schemas) and the Claude Code plugin's `tools/generate-references.ts` (emitting the committed `skills/*/references/*.json`). A shared package with one runtime consumer plus one generator is indirection without fan-out, and the plugin carrying a contracts dependency runs against the decision 34 trajectory of plugins as pure content. Three shapes for post-merge reference generation were weighed: (a) the plugin depends on the bridge and imports the registry through a source-only `./contracts` subpath export — the standard "each package generates its own artifacts" pattern, but the plugin keeps a contracts dependency in all but name, and the published bin-only bridge would advertise an exports subpath absent from its tarball; (b) the bridge generates every plugin's references — the plugin is fully decoupled, at the cost of a bridge tool writing outside its package directory; (c) a relative `../../packages/...` import with no manifest dependency — coupling the dependency graph can't see.

**Decision:** Option (b). The contracts move to `packages/mcp-bridge/src/contracts/` (registry, `hello`, skill-output schemas; the `analyzed-topic` spec joins the bridge's `test/unit/`), `mcp-server.ts` imports them relatively, and the bridge gains `@repo/shared-contracts` as a direct devDependency (previously reached through the contracts package's re-export). `generate-references.ts` moves to `packages/mcp-bridge/tools/` behind a new bridge `generate` script and iterates an explicit `pluginReferenceDirs` list (currently just `plugins/claude-code/skills/prepare-mcp-data/references/`). The plugin's `generate` shrinks to version stamping, its `@repo/mcp-contracts` devDependency is dropped, and the `@repo/mcp-contracts` package is deleted.

**Consequences:**

- The plugin is content plus release tooling only; a future OpenCode/Codex plugin gets its references by appending one directory to `pluginReferenceDirs`, not by copying a generator.
- The bridge writes outside its own package at generate time — accepted because the coupling is one explicit list and the `generate-check` CI job verifies the committed output on every change, exactly as before.
- MCP payload contracts are no longer importable by other workspaces. If an app ever needs them, they must be re-extracted — accepted; cross-cutting domain DTOs already live in `@repo/shared-contracts`, and the re-export of those from the contracts index remains bridge-internal convenience.
- Generated reference output is byte-identical before and after the move; the release flow is untouched (the plugin's `prepublishOnly` still stamps versions, the bridge's still builds the bundle).

## 39. The MCP bridge lives under `plugins/`

**Context:** After decision 38 the bridge owns the MCP contracts and generates every plugin's reference JSONs; it already releases on the plugin's version train (decision 33) and exists solely to be launched by agent-host plugins via `bunx`. Keeping it in `packages/` — otherwise all private, source-exported workspace libraries (`shared-contracts`, `local-contracts`, `typescript-config`) — misfiled the one other published, agent-facing artifact in the repo.

**Decision:** Move `packages/mcp-bridge` → `plugins/mcp-bridge`. `plugins/` now means "everything shipped to agent hosts" (the bridge plus per-host plugins); `packages/` means internal workspace libraries. Path references updated in `release.yml`, `biome.json` (the `noFloatingPromises` override), the plugin's `bump-version.ts` and `tarball.test.ts`, `README.md`, and the bridge's own `repository.directory`.

**Consequences:**

- Workspace globs (`plugins/*`), the Dockerfile's `COPY --parents` manifest globs (decision 36), and the CI `ts` paths filter all already covered `plugins/**` — none needed changes, exactly the insulation decision 36 aimed for.
- The bridge's `generate-references.ts` reaches sibling plugins as `../../../plugins/<name>/...` from its tools dir, which resolves identically from the new location.
- Git history follows the move (rename detection); decision log references to the old path remain as history.

## 40. The apps are `backend` and `frontend`

**Context:** `apps/server` and `apps/ui` carried names from the original scaffold. "server" was ambiguous (the MCP bridge is also a server; `Bun.serve`, the Vite dev server, and the `/ui` HTTP surface all overload the words further) and "ui" doubled as the name of a workspace, an HTTP surface (`/ui/*`), a container path (`./ui`, `UI_DIST_PATH`), and a Railway artifact.

**Decision:** Rename the workspaces to `apps/backend` / `apps/frontend`, package names `backend` / `frontend` (the frontend's typed-client devDep becomes `"backend": "workspace:*"`, imported as `backend/client`). The root `dev:server` script becomes `dev:apps`. Renamed _repo-side_ references only: Dockerfile build filters and stage paths, `railway.json`'s `dockerfilePath`, the CI bun-version guard path, `biome.json` overrides, `.gitignore`, `renovate.json` ignorePaths, the bridge e2e's backend path, and README. Deliberately **not** renamed: the `/ui/*` HTTP surface, `UI_DIST_PATH`, and the container-internal `./server` / `./ui` layout — those are runtime API and image-internal naming, decoupled from workspace names; historical docs (`docs/work/`, `docs/sdlc-migration-plan.md`) stay as written.

**Consequences:**

- `bun run --filter=backend` / `--filter=frontend` replace the old filter names; muscle-memory `dev:server` is gone in favor of `dev:apps`.
- Workspace globs, Dockerfile manifest `COPY --parents` globs, and the CI paths filter needed no changes (`apps/*` covered both names).
- Verified beyond CI: the production image was built and booted locally (healthcheck + SPA serve) since Dockerfile changes only otherwise surface at Railway deploy time.
- The README's contracts diagram was refreshed in passing — it still described `@repo/mcp-contracts`, which decision 38 had merged into the bridge.

## 41. The `apps/` workspace directory is `server/`

**Context:** After decision 40 the repo's top-level split was `apps/` (backend + frontend), `plugins/` (agent-host side: bridge + per-host plugins), `packages/` (internal libraries), `scanners/`. "apps" was scaffold vocabulary; the two members it held are not independent apps operationally — they build into one Docker image and deploy as one Railway service (decisions 17/18/28).

**Decision:** Rename `apps/` → `server/`: the directory now names the deployed Noesis service, mirroring `plugins/` naming the agent side. Layout: `server/backend`, `server/frontend`. Updated: `workspaces.packages` glob, the Dockerfile's `COPY --parents` manifest glob and stage paths (the "one remaining duplication" decision 36 called out), `railway.json`, the CI paths filter and bun-version guard, `biome.json`, `.gitignore`, `renovate.json`, bridge e2e path, README. The root `dev:apps` script (named in decision 40) becomes `dev:server` — with the directory rename the name finally matches what it runs: the server stack.

**Consequences:**

- Package names (`backend`, `frontend`) and all `--filter` invocations are untouched; only paths changed.
- The CI `ts` filter now watches `server/**` — a path-gating rename, verified by this change itself triggering the full verify.
- The production image was rebuilt and booted locally from the new Dockerfile paths (healthcheck ok) before commit.
- Historical docs keep the old paths, as always.

## 42. Commit messages follow Conventional Commits with a four-type vocabulary

**Context:** Commit messages so far were free-form. Conventional Commits v1.0.0 is the ecosystem standard for machine-readable history, but its open-ended type list (Angular's `docs`, `refactor`, `style`, `test`, `perf`, `build`, `ci`, ...) invites taxonomy bikeshedding for a repo of this size.

**Decision:** Adopt [Conventional Commits v1.0.0](https://www.conventionalcommits.org/en/v1.0.0/#specification) with the type vocabulary restricted to exactly four: `feat` (new behavior), `fix` (wrong behavior made correct), `improvement` (a one-time betterment with behavior unchanged — code quality, performance, docs, tooling, the development pipeline; subsumes `refactor` and `perf`), and `chore` (recurring maintenance — dependency updates and other routine upkeep). The improvement/chore discriminator is cadence, not surface: a one-time CI upgrade is an `improvement`, while the dependency bumps it produces forever after are `chore`s. Spec rule 14 explicitly permits types beyond `feat`/`fix`, so `improvement` is spec-compliant. All other spec mechanics apply unchanged: optional noun scope, `!` and/or uppercase `BREAKING CHANGE:` footer for breaking changes, imperative ≤72-char subject. The convention is encoded as an agent skill at `.claude/skills/commit-message/SKILL.md`, which generates messages from the actual staged diff, and enforced by a plain-sh `.githooks/commit-msg` hook (active via the existing `core.hooksPath` wiring) that validates the subject format and the blank line before the body, exempting merge, revert, and autosquash commits.

**Consequences:**

- History becomes greppable by intent (`git log --oneline | grep '^....... fix'`) and ready for changelog tooling should it ever be wanted; nothing currently parses the types, so this costs only discipline.
- The four-way split has one judgment call per commit (feature vs improvement vs chore), resolved by the skill's rules: cadence decides improvement vs chore, dominant change wins for mixed diffs — or split the commit.
- `improvement` deviates from the Angular-preset names most tooling defaults to; the `commit-msg` hook is hand-rolled sh (matching the existing hook style) rather than `commitlint`, so there is no type enum to keep in sync beyond the one regex.
- Pre-convention subjects fail the hook's check by design — it gates new commits only; history stays as written. `git commit -n` remains the WIP escape hatch, at the cost of also skipping the pre-commit format/lint checks.
- Existing history stays as written, per the usual convention.

## 43. Work starts as typed, scoped task docs under `docs/work/`; the `init-task` skill owns initiation

**Context:** Task documents existed only ad hoc at the repo root (`docs/work/chores/*.md`), with no defined place for feature or fix write-ups and no defined process for starting a piece of work. With the four-type commit vocabulary (42) and per-area docs folders already emerging (`docs/`, `server/docs/`, `server/frontend/docs/`), task initiation needed the same structure: where a task doc lives, what it contains, and how its requirements get elicited.

**Decision:** Every scope directory owns a `docs/work/` tree with one subfolder per commit type, in plural form: `feats/`, `fixes/`, `improvements/`, `chores/` (the existing `docs/work/chores/` already complies). Scopes are three-leveled and discovered from the tree, never hardcoded: the repo root (`docs/`), the four subsystems `server`/`plugins`/`packages`/`scanners` (`<subsystem>/docs/`), and any package directory holding a project manifest (`<package>/docs/`). Folders are created lazily — only when a task first lands there. Tasks are initiated through the `init-task` agent skill (`.claude/skills/init-task/SKILL.md`): it determines type and narrowest-containing scope, elicits requirements before writing anything — delegating to the `domain-stories` skill for `feat` tasks (Need Statements + Job Stories become the Requirements section) and running a lighter type-specific interview for `fix`/`improvement`/`chore` — then, after a confirmed summary, writes a kebab-case task file with frontmatter (`type`, `scope`, `status`, `created`) and the sections Context, Problem/Goal, Requirements, Constraints, Non-goals, Open questions, and an empty Solution options.

**Consequences:**

- A task file is deliberately problem-space only; it ends where solutioning begins (the empty Solution options section), and whatever solutioning decides belongs in the scope's `decisions.md`, keeping the two document kinds disjoint.
- The task's `scope` value doubles as the commit scope, so the folder taxonomy and commit history stay aligned by construction.
- `system-requirements` (EARS) is intentionally not part of initiation — it applies after a solution option is chosen.
- New packages need no registration anywhere: having a manifest makes a directory a valid scope, and its `docs/work/` appears with its first task.

## 44. TypeScript 7 (native Go compiler)

**Context:** TypeScript 7.0 replaces the JavaScript-based compiler with a native Go port (8–12× faster full builds, parallel check/emit); 6.0 was the designated migration bridge that turned the legacy options into deprecations. The workspace was already on 6.0.3 and clean of everything 7.0 removes: `NodeNext`/`Bundler` module resolution, ES2022+ targets, `strict`, no `baseUrl`/`outFile`/AMD/UMD. Nothing in the toolchain consumes the TypeScript programmatic API — linting is Biome (25), transpilation is bun/Vite, and `tsc` runs only as `check-types` (`--noEmit`) — so 7.0's biggest gap (no stable programmatic API until 7.1, which blocks typescript-eslint and framework tooling elsewhere) does not apply here.

**Decision:** Bump the root catalog `typescript` from `^6.0.3` to `^7.0.2` — a one-line change, since every workspace resolves TypeScript via `catalog:` (30). Verified before committing: all six workspaces pass `check-types` on the native compiler, plus lint, tests, and builds.

**Consequences:**

- `tsc` is now a per-platform native binary shipped via `optionalDependencies` (one entry per OS/arch in the lockfile), no longer a JS package with a `tsserver` bin.
- If a future tool needs the TypeScript API before 7.1 lands, the escape hatch is the `@typescript/typescript6` compatibility package (`tsc6` binary + 6.0 API re-exports) — not a downgrade.
- Renovate (37) keeps the catalog entry current within `^7`; the 7.1 API release needs no action here unless a consumer appears.

## 45. UI shell: pathless layout route, context-registered right panel, `/ui/search` provider registry

**Context:** The ui app was still router scaffolding (`__root` + `index` + `about`). The shell it needed — collapsible sidebar with a project switcher, top bar with breadcrumbs, a Cmd+K palette, and a contextual right panel — had to be built once, before any real view (dashboard, React Flow canvas, BlockNote editor, settings) lands, and had to leave those views free to fill it in. Requirements and a static HTML mock are in `docs/work/features/ui-shell.md`.

**Decision:** Three mechanisms carry the shell.

1. **Routing.** `__root.tsx` holds providers only (`ThemeProvider`, `TooltipProvider`, devtools) and a pathless `_shell.tsx` layout route renders `ShellLayout`; the four views live under `routes/_shell/` and each carries `staticData: { breadcrumb, viewId }`. Breadcrumbs are derived from `useMatches()` — no breadcrumb map — and `viewId` keys the per-view right-panel state. A chrome-less route (print view, embed) can later sit beside `_shell` without unpicking anything.
2. **Right panel registration.** `ShellProvider` (plain context, no router coupling) holds project, selection, panel and palette state; `useRightPanel(Component)` registers panel content for as long as the caller is mounted. Registrations are a **stack** — a route registers its default, a selection inspector registers on top, and unmounting falls back — so selection refines the route's panel without either side knowing about the other. The hook takes a _component type_, not a rendered node: a stable module-level component keeps the registration effect from re-firing every render (an inline `<Panel/>` node would loop), while the component still re-renders freely against context.
3. **Search.** `GET /ui/search?q=` on the ui surface, backed by a `SearchProvider[]` registry in `SearchService` — empty today because nothing is searchable yet. The palette's entities group is wired end to end through the typed `hc` client and starts producing results the moment the first provider registers; the palette itself does not change. The result schema (zod, next to the route) is exported through `AppType`, so no contracts package was needed.

Shell state persists under one `noesis.shell.*` localStorage namespace: `theme` (absent means follow the OS), `sidebar`, `project`/`projects`, and `rightPanel.<viewId>` (`{ open, width }`).

**Consequences:**

- The panel width could not ride on `ResizablePanelGroup`'s `autoSaveId` as planned — react-resizable-panels v4 dropped it in favour of `defaultLayout`/`onLayoutChanged` — so the shell persists width itself, on user-driven resizes only, in the same per-view key as the open state.
- Views are placeholders by design; the dashboard carries a small selectable list purely to prove the selection → inspector flow.
- Components came from shadcn (Base UI, base-nova) rather than a Shadcnblocks block. Two Base UI mechanics that a static mock cannot reveal cost a browser round trip and are worth remembering: a menu label must sit _inside_ its `DropdownMenuGroup`, and a `render` target for a trigger must not itself wrap (a `SidebarMenuButton` with `tooltip` renders a Tooltip wrapper and swallows the trigger's props).
- `biome.json` gained two frontend overrides: `useComponentExportOnlyModules` allows the `Route` export in `src/routes/**`, and the vendored `src/components/ui/**` is exempt from it plus the a11y/exhaustive-deps/cookie rules that shadcn's own source trips. Provider modules were split so the rule stays strict for hand-written shell code (`shell-provider.tsx` + `use-shell.ts`, `theme-provider.tsx` + `use-theme.ts`).
- The tweakcn Claude theme needed five corrections in `index.css`, all of them already present in the prototype and all of them about surfaces rather than hue: `--card` equals `--background` in both modes (cards vanish, and dark mode reads as two flat tones), dark `--secondary` is a near-white fill with a dark foreground (an inverted chip in a dark ui), dark `--sidebar-accent` is _darker_ than the sidebar it sits on, `--sidebar-border` is near-white in dark (a light line down a dark sidebar), and dark `--sidebar-primary` is grey, dropping the terracotta. Each override is commented where it deviates. The shell then leans on the restored surfaces: cards get `shadow-xs`, the active sidebar item gets a terracotta rail (the one accent that survives icon-collapsed mode), and the dashboard's entity kinds use the chart tokens.
- The Vite template's leftover landing-page CSS (`#root` fixed width, global `h1`/`code` rules, a second dark-mode palette) was deleted from `index.css` along with `App.tsx`; it would have fought the shell layout. `index.html` gained a three-line theme bootstrap so a dark-mode reload does not flash light.

## 46. Identity is a GitHub App: hand-rolled user web flow on Octokit, sessions in the graph, `/auth` as a fourth surface

**Context:** Noesis had no authentication of any kind. Sign-in was needed, and separately the system needs to read users' repositories — so the identity provider and the resource server are the same party, and picking an identity mechanism is really picking a GitHub integration primitive. Requirements and the full design are in [`docs/work/features/github-login.md`](./work/features/github-login.md).

An OAuth App is the cheaper start (a day of work, no install step) but is decided against by repository access alone: it grants all-or-nothing `repo` scope, its token never expires and has no refresh, org admins must whitelist third-party OAuth access, the grant dies with the user's account, and rate limits are the user's. A GitHub App gives per-repository selection at install time, fine-grained permissions, 8-hour user tokens with 6-month refresh tokens, 1-hour installation tokens for work with no user present, an org-level install with an audit trail, and its own identity that survives the installer leaving. GitHub's own guidance says the same. Converting an OAuth App into a GitHub App later is a breaking re-authentication for every user, so the cheap start is not cheap.

For the implementation vehicle, Arctic — the usual "OAuth clients, bring your own session" library — was deprecated in July 2026, leaving Octokit as the maintained low-level option and one this system needs regardless to call the GitHub API. The alternative was Better Auth, which is better supported and would supply sessions, CSRF, account linking and an API-key plugin, but it expects a relational store while this server keeps exactly one datastore (the LadybugDB graph, per `config.ts`). That forces either a second `bun:sqlite` file beside the graph or a custom Cypher adapter against Better Auth's relational adapter contract, re-verified on every minor — and Better Auth's GitHub provider has a known gap storing `refresh_token`/`refresh_token_expires_in`, which is exactly what 8-hour user tokens depend on.

**Decision:**

- **A GitHub App is the identity provider**, using both of its authentication paths: the user-to-server web flow for sign-in, and server-to-server installation tokens (`@octokit/auth-app`) for later background work. Sign-in and repository installation are separate user-facing steps — an account can exist with no repository access, and the UI says so rather than conflating the two.
- **The OAuth mechanics are hand-rolled on `@octokit/oauth-methods`** (`getWebFlowAuthorizationUrl`, `exchangeWebFlowCode`, `refreshToken`), not on a class wrapper or a Node-http middleware that does not fit Hono on Bun. GitHub does not support PKCE, so CSRF protection is the `state` parameter checked against a separate short-lived signed cookie, keeping the flow stateless until a session exists.
- **`/auth` is a fourth top-level surface** beside `/ui`, `/api` and `/internal`, and joins `main.ts`'s SPA-fallback exclusion list. It qualifies under decision 18's own criterion: its consumer is the browser's address bar trading 302s and cookies, not the typed JSON RPC contract `/ui` owes `hc<AppType>`. It also sidesteps mounting unguarded routes inside a guarded sub-app. `/ui` gains a `requireSession` middleware and `GET /ui/me`, whose response type reaches the frontend through `AppType` — no contracts package, per decision 45's precedent.
- **Every deployment registers its own GitHub App.** App id, slug, client id, client secret and private key are all configuration; there is no central Noesis App, no secret custody and no per-tenant registration machinery, and a hosted Noesis instance later is one more deployment with one more config rather than a new mechanism. GitHub forces most of this anyway: an App carries a fixed callback URL list (max 10), so a single App cannot serve arbitrary self-hosted origins without a central callback proxy.
- **First login claims the instance; everyone after needs an invite.** GitHub authenticates identity and says nothing about whether this deployment wants the person, so `/auth/callback` applies an admission rule before any write: existing account → sign in; no account exists at all → this login becomes `role = 'owner'`; an unaccepted `Invite` matches the GitHub login → `role = 'member'` and the invite is consumed; otherwise no account, no session, redirect to `/login?error=not_invited`. Invites are by GitHub login (the one thing the callback can verify — `/user` email may be private or unverified), managed over `/ui/invites` behind a `requireOwner` middleware. The ownership claim is a conditional write guarded by the account count, not a read-then-write, so two simultaneous first logins cannot both win. A config-based allowlist was rejected as one forgotten redeploy from either locking the owner out or letting the internet in.
- **A project binds to exactly one installation** and tracks a subset of that installation's repositories (`Project -UsesInstallation-> GhInstallation`, `Project -Tracks-> Repository`). Cross-organisation projects are explicitly unsupported — a system spanning two orgs is two Noesis projects — which keeps the repository picker a flat list and lets every repository-scoped query resolve to a single installation token. Only the cardinality is settled here; the relationships and the `Repository` table land with project CRUD, which does not exist yet. It is settled now because it decides how `GhInstallation` is modelled today: hanging off `Account` alone, reached later from `Project` by a second relationship rather than an owning one.
- **Sessions and credentials live in the graph**, appended to `graph-schema.ts`: `Account`, `Session`, `GhCredential`, `GhInstallation`, `Invite` with `HasSession`/`HasCredential`/`HasInstallation` relationships. Only the SHA-256 of the session cookie is stored, so a database read cannot impersonate anyone. Tokens sit on their own node rather than as `Account` properties, so no query that reads a user can accidentally select a credential. They are encrypted at rest with AES-256-GCM under `NOESIS_TOKEN_KEY`. The cookie is `HttpOnly`/`Secure`/`SameSite=Lax` — `Lax` is both sufficient and required, since the OAuth callback is a top-level GET navigation that `Strict` would break.
- **Token refresh is centralised** in `GhTokenService.getUserOctokit(accountId)`, the only way handler code obtains a GitHub client. It refreshes inside a 60-second skew and writes back under the existing optimistic-concurrency `version` column; because refreshing invalidates the previous pair, the write-back is part of the same transaction that consumes the response.
- **The frontend guard sits on the layout route.** `routes/login.tsx` lives outside `_shell` — the chrome-less route decision 45 left room for — and `_shell.tsx` gains a `beforeLoad` that redirects on a 401 from `/ui/me`, so every present and future view under the shell inherits the guard with no per-route work.
- **`NOESIS_AUTH_MODE=disabled`** lets contributors run `dev:server` and the test suites without registering a GitHub App; it refuses to start when `NODE_ENV=production`.

**Consequences:**

- The `/api` surface stays unauthenticated for now. The MCP bridge runs on the user's laptop with no browser, so its flow is GitHub's device flow or a Noesis-issued token minted from settings — a separate decision, which decision 18's surface split already leaves room for.
- Seven new `NOESIS_*` variables become required configuration (public URL, App id and slug, client id and secret, private key, token key), so a Railway deploy and a local dev setup both now have a registration step; the README grows a section for it.
- Repository selection now happens on two screens with different authority: GitHub's install screen, where an org admin decides what the App may touch at all, and the Noesis project screen, which picks a subset of that. Noesis can neither offer nor request a repository the admin never granted; the UI's only move is a deep link to `https://github.com/organizations/<org>/settings/installations/<id>`. Expect this to arrive as a bug report before it arrives as a question.
- The instance is single-tenant by construction: one owner, invited members, and projects that cannot straddle organisations. Nothing here blocks multi-tenancy later, but nothing anticipates it either — `role` is a string rather than an `is_owner` boolean so a third role costs no migration, and that is the whole of the provision.
- Session security is now this repo's to own — state comparison, cookie flags, rotation, expiry, revocation — traded for a single datastore and explicit control over the refresh cycle. If the auth surface later grows past sign-in (organisations, 2FA, user-managed API keys), Better Auth with a second store becomes the better trade and this is the thing to revisit.
- `Account` is deliberately not called `User`, leaving room for a future domain notion of a person distinct from a login identity.
- Adding a second identity provider later needs a provider column on `Account` and a second credential node; nothing here assumes GitHub is the only provider, and nothing accommodates a second one yet.
- The build turned up five things the design could not have known. **(1)** Adding auth widened the ui app's _type_ graph: `hc<AppType>` pulls the whole backend module tree through `backend/client`, and the auth repository dragged `concurrency.ts` and `@repo/shared-contracts/uuid` into it for the first time. Both tripped the frontend's stricter compiler — `erasableSyntaxOnly` rejects constructor parameter properties, and `Bun.randomUUIDv7()` has no ambient types there — so two error classes were rewritten with explicit fields and `uuid.ts` gained a `/// <reference types="bun" />`. Any module reachable from a route handler now has to compile under the ui app's settings, which is a constraint worth remembering before reaching for a decorator-ish shortcut in a service. **(2)** `@octokit/oauth-methods` reads `response.data.scope` unconditionally and anchors token expiry on the response's `Date` header, both of which a hand-written GitHub fake has to supply. **(3)** The `state` cookie is signed with the client secret rather than an eighth configured secret — it is already the App's shared secret with GitHub and never reaches a browser. **(4)** `GhTokenService` carries an in-process single-flight map on top of the optimistic-concurrency column: a refresh consumes the refresh token, so two concurrent refreshes in one process would leave the loser holding a dead pair, and the `version` check only covers the cross-process case. **(5)** `/ui/me` also returns `authMode`, so the ui can tell "signed in as the local owner" from a real session without a second endpoint.
- Two details landed differently from §7 of the plan, both simplifications. There is no separate `AuthProvider`: `ShellLayout` reads `/ui/me` from the query cache the route guard already filled and passes the account into the existing `ShellProvider`, so the shell keeps exactly one context. And the `hc` client's 401 interceptor deliberately ignores `/ui/me` — the route guard owns that 401 and turns it into a router redirect, while a 401 anywhere else means the session died under a view that cannot recover, so the interceptor navigates.
- Logging out revokes the Noesis session, not the GitHub grant. Revoking the authorization would force a re-authorization screen on the next sign-in, which is not what "sign out" means; the grant is the user's to revoke on GitHub.
- `GhAppService` (installation tokens via `@octokit/auth-app`) ships with no caller, as §10 anticipated. It is here because it is the same App registration and the same configuration; webhook handling and background scanning pick it up.
- Every process that spawns the real server in a test — the SPA-serving e2e and the MCP bridge's full-stack e2e — now passes `NOESIS_AUTH_MODE=disabled`, because the server fails fast without a GitHub App. That is the escape hatch doing its job, but it does mean the guard itself is only exercised by the in-process e2e (`test/e2e/auth.e2e.spec.ts`), which drives the composed app directly.
- In local development `NOESIS_PUBLIC_URL` is the **Vite dev server's** origin, not the backend's: sign-in is a navigation, so the callback has to land on the origin the browser is on. The dev server proxy gained `/auth` alongside `/ui` for the same reason.

## 47. Scanning runs on CI or the developer's machine; the server only receives results

**Context:** Decision 46 and the projects-feature elicitation
(`docs/work/features/projects.md`) both implicitly assumed that source-code
scanning would run on the Noesis server, with installation tokens
(`GhAppService`) as the credential for cloning and reading repositories in the
background. The high-level architecture (`docs/arch/high_level.png`) says
otherwise: scanners live inside the project repositories themselves (the TS,
.NET and Java scanners plus per-language Noesis annotations), and the
"Noesis local" process that runs them sits next to the code — on a developer's
machine or in CI — talking to the server over its API.

**Decision:** Source-code scanning executes where the code already is — in a
CI pipeline or on a local machine — never on the Noesis server. The scanners
read the working copy that the CI job or developer already has checked out,
using that environment's existing credentials. Only scan _results_ are
uploaded to the server, which stores them in the graph. The server never
clones, fetches, or reads repository source.

**Consequences:**

- Installation tokens are not a scanning credential. The GitHub App's
  repository access serves identity, repository listing/verification for
  project connections, and later webhooks or PR integration — not source
  reads. The background-scanning caller that decision 46 anticipated for
  `GhAppService` will not materialise in that form.
- The server needs a result-ingestion surface that CI can authenticate
  against without a browser session. This lands together with the
  MCP-bridge/API-token question decision 46 already deferred (`/api` is
  currently unauthenticated); it is a separate decision.
- Private source code never leaves the owner's infrastructure; the server
  holds only derived analysis data. This is a deliberate data-locality
  property, not an accident of the topology.
- Revoking the App's access to a repository does not technically stop
  scanning — CI still has the code. Whether the server keeps accepting
  result uploads for a disconnected repository is a policy question, tracked
  in the projects feature's open questions.
- The server carries no clone storage, no scanning queue, and no scanner
  runtime; scaling scanning means scaling CI, which the customer already
  owns.

## 48. Projects own their repositories in a server-side registry; scanners route uploads by repository identity

**Context:** The projects feature (`docs/work/features/projects.md`) needs a
binding between projects and GitHub repositories. Two shapes were compared:
(A) a server-side connection registry in the graph, created through the UI
repo picker, with the server as source of truth; and (B) a repo-side
declaration — a config file in the repository naming its project — with the
server deriving membership from uploads. B's rename problem is fixable by
declaring a project _id_ rather than a name, but the deeper issues remain:
branches and forks of one repository can carry divergent or hijacked
declarations, conflicts surface asynchronously in CI logs instead of at the
point of action, lifecycle operations become commits across N repositories,
and a project would not exist before its first pipeline run — leaving the
elicited connection, grant-access, and refusal flows nowhere to live. Since
scanning runs off-server (47), the scanner still needs to route results to
the right project regardless of which side owns the binding.

**Decision:** Option A. Project–repository connections live in the graph as a
server-side registry, created and changed through the Noesis UI; the
repository carries no Noesis project state. Routing rides on the exclusivity
rule the domain already demands: a repository belongs to at most one project,
so the scanner authenticates and states _which repository it scanned_
(derived from the git remote / CI context) and the server resolves the owning
project from the registry — renames, detach-and-reconnect, and deletions are
registry operations with no repo-side residue, and a fork resolves to its own
repository identity and simply is not connected. Repository identity in an
upload is a claim and must be attested, not trusted: the intended default is
GitHub Actions OIDC (a GitHub-signed JWT whose `repository` claim is checked
against the registry), which needs no secret in the repo or in CI; the repo
then carries at most the server URL. Non-GitHub CI and local scans
authenticate via a Noesis-minted upload credential — the same deferred
credential mechanism as the MCP bridge (46). The ingestion surface itself is
a separate feature and decision.

**Consequences:**

- The elicited integrity rules (one repo → one project, duplicate-name
  refusal, last-repo detach refusal) are enforceable synchronously at the
  point of action, because the registry is consulted before anything is
  written.
- Spoofed uploads for a registered repository fail structurally: rejecting
  unregistered repositories is not the protection — attestation of the
  claimed identity is.
- A repo-side declaration may return later as a convenience on top of the
  registry, never as the binding: an onboarding hint (unknown repository
  with a declared project id → pending connection awaiting confirmation) or
  an App-authored onboarding PR adding the config file / workflow. That PR
  path requires widening the App's permissions to Contents + Pull requests
  (+ Workflows) read/write, which every existing installation must
  re-approve — a cost that grows with adoption, so the permission set should
  be settled early in the App's life.
- The scanner's configuration surface stays minimal: server URL plus
  whatever the ingestion feature defines for authentication; nothing
  project-specific to maintain in repo content or CI variables.

## 49. Design-doc detail panel has a fixed section list; Modified is derived from scanner-comparable fields only

**Context:** The collaborative design-document specification
(`docs/work/features/design-doc/design-doc.md`) left two questions open that
blocked the Stage 1 prototype comparison. The use-case detail panel listed
"likely sections", so three prototypes would each invent their own set and the
lens comparison would measure section choice rather than interaction model.
And the Existing / New / Modified / Removed status was said to be derived from
baseline comparison without saying which field changes count, so a description
typo could mark an element Modified and the canvas markers would drown the
element names they are supposed to stay quieter than.

**Decision:**

1. The use-case detail panel has eleven fixed sections in a fixed order:
   Summary, Actors, Description, Rules, Input, Output, Acceptance scenarios,
   Quality attributes, Related building blocks, Interaction flow, Comments.
   Behavior type is a badge beside the name, not a section. A lens hides
   sections but never reorders or renames them; the Product lens hides only
   Related building blocks and Interaction flow; an empty section collapses to
   a quiet add-content prompt rather than disappearing.
2. An element is Modified when a _baseline-comparable_ field differs from its
   baseline value — the fields a source-code scanner can populate: name, type,
   owning application service, actor references, input and output structure,
   behavior relationships. Design-only fields (summary, description, rules
   prose, quality attributes, acceptance scenarios, comments) never produce
   Modified. Codebase-relative state does not propagate upward through
   containment.

**Rationale:** Both decisions buy quietness without hiding information. Fixing
the section list makes the single-specification promise observable — Product
and Technical participants see the same eight of eleven sections, so the lens
is visibly a filter and not a second document — and it narrows the remaining
open question to how Input and Output should read in the Product lens. Scoping
Modified to scanner-comparable fields gives every visible marker one meaning,
"the source code must change here", and bounds marker count by real code delta
rather than by editing activity; spec-only additions still surface in proposal
impact summaries, so review loses nothing. Suppressing upward propagation
keeps one new use case from lighting up its application service and bounded
context, which containment in the catalog already communicates.

**Consequences:**

- The design model must distinguish baseline-comparable fields from
  design-only fields, since only the former participate in comparison.
- Stage 1 prototypes are comparable on interaction model alone, and share both
  a sample dataset and a section list.
- The earlier prototype sketches predate this model and moved to
  `docs/work/features/design-doc/prior-art/` as reference material.

## 50. The design-doc model is normalised, addressed by stable ids, and derives codebase state rather than storing it

**Context:** Phase 1 of the design-document workspace plan
(`docs/work/features/design-doc/plan.md`) replaces `design-doc.ts`. The old
schema was a tree of `changeSetSchema(...)` wrappers — every level carried
`added` / `removed` / `modified` arrays — with behaviours nested inside
building blocks, an `actor: string | null`, one string each for `given`, `when`
and `then`, and a `*_locked` boolean beside every field. Three product
decisions have since made that shape unworkable: New / Modified / Removed
describe the accepted design's delta from a scanned codebase baseline rather
than the contents of a pending proposal (specification §14.7), use cases are
first-class and reference many actors (§14.1–14.2), and comments, suggestions
and agent chat context all anchor to an individual typed element (§14.8), which
requires that element to have an address. The schema had no consumers outside
its own tests, so it could be replaced rather than migrated.

**Decision:**

1. The portable specification is a normalised document: flat arrays of actors,
   bounded contexts, domain modules, building blocks, use cases and behaviours,
   related by id. Change-set wrappers are gone.
2. Every element the document renders as its own block carries a stable `id`,
   including rules, fields, Gherkin steps and example rows. Ids are unique
   across the whole document, not per collection. Nothing is addressed by
   position.
3. An address is an `ElementRef` (`design-doc-ref.ts`):
   `{ kind: 'element', id }` for anything carrying an id, resolved through one
   document-wide index, and `{ kind: 'slot', ownerId, path }` for the few places
   that hold no element of their own — the goal text, `output.summary`, a list
   as an insertion point. There is no string form of an address, and nothing
   parses one.
4. Codebase-relative state is derived, not stored. Each comparable element
   holds a snapshot of its baseline-comparable projection plus an explicit
   `markedForRemoval`; `design-doc-baseline.ts` turns those into Existing, New,
   Modified or Removed and explains the difference.
5. Comments, suggestions and whole-document agent proposals live in
   `design-doc-collaboration.ts`, referencing the document by id and anchoring
   into it by element ref. They never travel inside the specification.
6. The `*_locked` booleans are dropped in favour of authorship (§14.6): prose
   records whether a human or the agent wrote it, and nothing in the model
   claims a collaborator is prevented from editing.
7. A use case and a behaviour are separate types that name each other. A
   `DesignedBehaviour` belongs to a building block and is a node of the
   invocation graph; a `DesignedUseCase` belongs to an application service,
   references actors and owns the document's acceptance scenarios. The
   behaviour that is a use case's entry point carries `useCaseId`, and the use
   case carries `behaviourId` back.
8. There is no separate application-service record. An application service is a
   `DesignedBuildingBlock` whose `type` is `application_service`, so
   `UseCase.applicationServiceId` and `DesignedBehaviour.buildingBlockId`
   resolve in one id space.

**Rationale:** Ids-not-positions is what makes the rest safe. The editor lets
people drag a block within its schema array, so a positional address would
silently re-point every comment on a list the moment someone reordered it.
Storing the id rather than the path goes further: a ref survives the element
being renamed, moved to another parent, and a schema field around it being
renamed — none of which an embedded path survives. An earlier draft of this
decision carried a readable path expression, `useCase[uc-book].rules[rule-hold]`,
as the stored address, with a grammar to parse it back. Once refs became what
gets stored, nothing produced such a string that anything had to read, and a
display format that no longer round-trips belongs with the view that renders it,
not in a contracts package. Deriving state rather than storing it makes
decision 49 enforceable in code instead of by convention — the comparable
projection simply has no field for a summary, so no amount of prose editing can
produce a Modified marker — and the stored snapshot is what lets a Modified
element say what the source code must change. Keeping collaboration out of the
specification means exporting or scanning a document does not drag conversation
along with it.

**Consequences:**

- `DesignDocSchema` is now `DesignDocumentSchema`, and the `Designed*` element
  schemas changed shape. Nothing outside `packages/shared-contracts` imported
  them, so there is no migration to write; stored documents do not exist yet.
- Ids must be non-empty and unique across the whole document, since an element
  ref is a bare id resolved through one index. There is no restriction on their
  characters, because nothing parses them.
- Anything that creates an element must mint an id for it, including the editor
  and any agent or scanner that writes into the model.
- A slot ref is the one address that embeds a field name, so renaming `rules` or
  `summary` invalidates slot refs while leaving every element ref intact.
- Behaviour relationships and scenario paths (§14.4–14.5) are still absent.
  Behaviour and scenario ids are stable so they can be added without
  re-anchoring anything.
- Building blocks, domain modules, properties and behaviours are modelled but
  largely unrendered: nothing in the document view reads them this iteration.
  They are here because the Technical lens and the scanners need the vocabulary,
  and because a behaviour graph with no behaviour type has no nodes.
- Referential integrity cannot be enforced by the element schemas, since zod
  validates one object at a time. `design-doc-integrity.ts` carries it as a
  separate whole-document pass: `checkDesignDocument` returns coded issues, each
  anchored to an element ref and naming the element in words, separating errors
  (a broken document) from warnings (a
  document that resolves but will read wrong, such as an element compared
  against a scan the document is no longer on).

## 51. The Yjs document is the editing truth; `DesignDocument` is the interchange format

**Context:** Phase 3 of the design-document plan puts the document view on
BlockNote with a custom block schema. BlockNote wraps ProseMirror, and
ProseMirror owns its own document representation — a tree of nodes conforming to
a schema, with integer positions its transaction system maps through every
change, and with selection, undo, input rules, decorations and the Yjs binding
all operating on that tree. A ProseMirror document therefore exists whether or
not one is designed for it. The two representations are also not isomorphic:
`rule.text` is a `string` in the model, but the same text in the editor carries
marks — comment anchors, suggestion tracking — which ProseMirror holds as
mark-bearing inline nodes.

Plan §4 says each block type maps to one design-doc element but does not say
which side holds the truth. Phase 1 shipped `DesignDocument` as a zod schema
with nothing persisting it yet, and the agent produces one as structured
output, so the question is open while it is still free to answer.

Three shapes were considered. Two stores kept in step — a Y.Doc and a persisted
`DesignDocument` — is a dual write, where every sync bug is a data-loss bug.
`DesignDocument` as the truth with the editor rebuilt from it on each change
cannot carry collaboration: rebuilding the ProseMirror document discards
cursors, undo history and concurrent merges. A shared CRDT model that is not a
ProseMirror document, with BlockNote projecting it, fights y-prosemirror, which
requires the editor's document to be the shared type.

**Decision:**

1. The custom BlockNote block schema is required rather than incidental. What
   may be inserted at a point, what may nest in what, what a paste coerces to
   and what a drag may reparent all come from the ProseMirror schema, so it is
   the mechanism by which "nothing untyped" is enforced rather than merely
   intended.
2. One Yjs document per design document is the stored truth for editing. Marks
   and Yjs relative positions live there and nowhere else.
3. `DesignDocument` is the interchange format, not a store: agent output,
   scanner output, API reads, export, and the input to
   `checkDesignDocument`. It is derived from the Y.Doc on read and may be
   cached, invalidated on Y.Doc update — a cache, never a second source of
   truth.
4. Every write from outside the editor is whole-document replacement: initial
   creation, an accepted proposal, a scanner import, a baseline refresh. One
   `toBlocks(document)` function serves all four. No incremental external
   change is ever merged into live editor state.
5. An incoming document is validated at the boundary — `DesignDocumentSchema`
   then `checkDesignDocument` — before it is seeded. A document that fails is a
   retry, not a seeded Y.Doc.
6. Seeding happens exactly once, server-side, when the document is created.
   Clients sync into an already-populated document and never initialise an
   empty one.
7. Design-doc ids are the BlockNote block ids. Elements below block granularity
   — Gherkin steps, example rows — keep their ids in block attributes.

**Rationale:** The editor needs its own _schema_; it does not need its own
_store_, and the distinction is where the sync bugs live. Making the Y.Doc the
single stored representation removes the dual write outright: a projection
recomputed from the truth cannot drift from it. The direction that would be
hard — merging an external incremental change into a live collaborative state —
never has to exist, because every external write is already whole-document by
product decision (specification §6.3–6.4). And the direction that remains,
`DesignDocument` to blocks, is needed under every option anyway, since an
agent-generated document has to reach the editor somehow.

Keeping `DesignDocument` as the interchange format also keeps the agent
interface unchanged and correct: a model emits a typed JSON object it can be
constrained to, never a ProseMirror node tree or a CRDT update. Validating at
the boundary turns the agent's normal failure mode — inventing an
`applicationServiceId` that names nothing — into a retry prompt instead of a
corrupted document.

Seeding once and server-side is not a preference. Two clients that each
initialise the same empty Y.Doc produce two concurrent inserts of the whole
document, and Yjs merges both.

**Consequences:**

- The projection must be total. If the Y.Doc can reach a state that does not
  project to a valid `DesignDocument`, the typed guarantee has already failed
  and `checkDesignDocument` is catching it rather than the schema preventing
  it. Running the integrity check over the projection during phase 3 is how
  that stays honest.
- Seeding runs headless, so block-to-ProseMirror conversion must work outside a
  browser. BlockNote ships `@blocknote/server-util` for this; the frontend
  currently depends only on `core`, `react` and `shadcn`, so confirm it exists
  at 0.53 before planning around it rather than driving `prosemirror-model`
  directly.
- A stale projection cache is indistinguishable from drift at the point it is
  read. Invalidate on update and keep the cache visibly a cache.
- The portable specification carries plain text, because marks stay in the
  Y.Doc. That is what §14.8 asks for, and it means an export never leaks
  comment or suggestion state.
- Undo and version history belong to the Y.Doc, which is what makes a
  chat-applied change reversible (plan §8): "applied directly" is only
  acceptable while undo is within reach.
- Document-wide unique ids (decision 50) become load-bearing twice over, since
  they are now also the editor's block ids.

## 52. The codebase-delta feature is deferred whole to a future iteration

**Context:** Phase 1 of the design-document workspace delivered the
codebase-baseline model alongside the portable specification: scanner identity
per element, baseline snapshots of scanner-comparable projections, derived
Existing / New / Modified / Removed state (`design-doc-baseline.ts`), the
active-scan reference with newer-scan tracking, and the integrity warnings
that kept them coherent. Nothing consumed any of it — no scanner feeds the
model yet, no UI renders a delta marker, and the scanner-baseline delivery
phase sat last in the plan behind everything the first iteration actually
ships.

**Decision:** Remove the codebase-delta feature from this iteration's
requirements and plan entirely, and reintroduce it in a future iteration.
Removed from the model: `ScannerIdentity`, per-element `baseline` snapshots
and `*Comparable` projections, `markedForRemoval`, the document-level
`BaselineRef`, `CodebaseState`, `design-doc-baseline.ts`, the `stale-baseline`
and `removal-without-baseline` integrity warnings, and the `source_scan` and
`baseline_refresh` proposal triggers. Specification sections 2.6, 6.2, 8.3 and
14.9 are marked deferred; the scanner-baseline phase left the plan.

**Consequences:**

- The first iteration's document carries design intent only; nothing in it
  claims a relationship to scanned source code.
- Element ids stay stable and document-wide unique (decision 50), so baseline
  metadata can be reattached later without re-anchoring comments, suggestions
  or proposals.
- Decision 49's derivation rule (Modified from scanner-comparable fields only,
  no upward propagation) travels with the feature and binds its future
  reintroduction rather than current code.
- Proposals keep the impact-summary and challenged-decision shape, which is
  independent of baseline comparison; scan-driven triggers return with the
  feature.

## 53. Hocuspocus is the Yjs collaboration backend, persisted in the graph, behind a `/collab` surface

**Status: accepted** (2026-08-17) — both phase-3 verification items passed before
implementation: Hocuspocus 4.6 runs on Bun's native WebSocket (its
`WebSocketLike` interface names Bun's `ServerWebSocket` explicitly, and
`handleConnection`/`handleMessage`/`handleClose` map onto `Bun.serve`'s
callbacks), and `@blocknote/server-util` 0.54 covers headless
block-to-ProseMirror conversion (`blocksToYDoc` / `yDocToBlocks`). Two
integration notes from the spike: Bun frees a request's headers once the
WebSocket upgrade succeeds, so the cookie must be snapshotted into a new
`Request` before upgrading; and the hook payloads' `requestHeaders` is a
`Headers` object read with `.get()`, not a plain record.

**Context:** Decision 51 makes one Yjs document per design document the stored
truth for editing, seeded exactly once server-side, with `DesignDocument`
derived on read. That leaves the transport and persistence unnamed: the
frontend holds only `yjs` itself (no `y-websocket`, no `@hocuspocus/*`, no
`@blocknote/xl-*` collaboration packages), and the backend — Hono on Bun with
LadybugDB as its single datastore (decision 46) — has no WebSocket surface at
all. Phase 3 needs a server that speaks the Yjs sync and awareness protocols,
authenticates the connection, persists updates, and hosts the seed-once hook.

Three options were considered. A bare `y-websocket` server is minimal but
leaves auth, persistence, debouncing and awareness plumbing hand-rolled — the
Better Auth trade from decision 46 in reverse. A hosted service (Liveblocks,
y-sweet) removes the backend work but moves document content to a third
party, sits poorly beside the self-registered GitHub App model where every
deployment owns its data, and adds a paid external dependency to
self-hosting. Hocuspocus is the de-facto self-hosted Yjs server: maintained
by the Tiptap team, protocol-complete (sync, awareness, auth hook,
debounced persistence), storage-agnostic through fetch/store hooks, and the
server BlockNote's own collaboration documentation pairs with.

**Decision:**

- **`@hocuspocus/server` provides the collaboration protocol**, embedded in
  the existing backend process rather than run as a second service, so one
  deployment stays one process and one configuration.
- **`/collab` is a fifth top-level surface** beside `/ui`, `/api`,
  `/internal` and `/auth`, joining the SPA-fallback exclusion list. It
  qualifies under decision 18's criterion the same way `/auth` did: its
  consumer is a WebSocket speaking the Yjs binary protocols, not the typed
  JSON RPC contract `/ui` owes `hc<AppType>`.
- **The session cookie authenticates the upgrade.** The browser sends the
  existing `HttpOnly` session cookie with the WebSocket upgrade request;
  `onAuthenticate` verifies its SHA-256 against the graph exactly as
  `requireSession` does, and rejects the connection otherwise. No second
  token scheme.
- **Documents persist in the graph, as Yjs binary state.** An
  `onStoreDocument` hook (debounced) writes the encoded Y.Doc state into a
  node owned by the design document; `onLoadDocument` reads it back. This
  keeps decision 46's single-datastore principle — no second store appears
  because collaboration arrived.
- **Seeding stays decision 51's:** creation runs
  `DesignDocumentSchema.parse → checkDesignDocument → toBlocks → seed`,
  server-side, once, before any client connects. `onLoadDocument` only ever
  loads existing state; it never initialises an empty document.
- **The frontend connects with `@hocuspocus/provider`**, handed to
  BlockNote's collaboration option, carrying presence and cursors on the
  same awareness channel (plan §5).

**Consequences:**

- Two verification items block the phase-3 start: whether Hocuspocus's
  WebSocket stack runs on Bun's Node-compat layer (it builds on the Node
  `ws` ecosystem), and whether `@blocknote/server-util` at 0.53 covers
  headless block-to-ProseMirror conversion for seeding. Either failing
  revisits this decision before code is written — the fallbacks are running
  the collab server as a Node sidecar, or driving `prosemirror-model`
  directly.
- The Yjs binary state in the graph is opaque to queries. Anything that
  needs to read a document server-side goes through the projection to
  `DesignDocument` (decision 51), never through the stored bytes.
- Undo, version history and the durable substring anchors (marks) all live
  in the Y.Doc and therefore in this persistence path; losing the stored
  state loses them, so the graph's backup story now covers editor history
  too.
- Comments and suggestions remain their own records (specification §14.8);
  the awareness channel carries their live updates but never their truth.
- The `/collab` surface is browser-facing only. The MCP bridge and future
  agents write through whole-document replacement on the API surface, not
  through a Yjs connection.

## 54. The collab provider's client lifecycle is StrictMode-safe: detach on cleanup, destroy only on real unmount, editor built with `withCollaboration`

**Status: accepted** (2026-08-17) — implemented and verified end to end: with
the fix, two browser tabs on the Vite dev server sync live edits and remote
cursors in both directions, and the state persists through `onStoreDocument`;
before the fix, the same test showed edits staying local forever.

**Context:** Phase 3 wired the editor to `HocuspocusProvider` with
`useState(() => new HocuspocusProvider(...))` and
`useEffect(() => () => provider.destroy(), [provider])`. Under React
StrictMode — which the app runs in development — every mount is followed by a
simulated unmount/remount, so that cleanup ran once against a provider whose
`useState` instance survived the remount. `destroy()` is not reversible: the
provider registers its Y.Doc `update` handler at construction and only
`destroy()` removes it (`attach`/`detach` manage socket listeners alone), so
the remounted component held a provider that still received server state but
never sent a document update again. The failure was silent and dangerous: the
editor kept working against its local Y.Doc, nothing errored, edits simply
never reached the server or other clients — and a stale duplicate editor
instance (StrictMode also double-creates the `useCreateBlockNote` result)
could push a near-empty state and wipe the shared document, which is how the
sample document was lost during diagnosis. Production builds have no
StrictMode double-invoke and were unaffected. Separately, passing the bare
`CollaborationExtension` into `extensions` left BlockNote's local ProseMirror
`history` extension active alongside `y-undo`, so undo could revert other
collaborators' edits instead of only one's own.

**Decision:**

- **The provider effect is symmetric: `attach()` on setup, `detach()` on
  cleanup.** Both are no-ops when already in the target state, so the
  StrictMode cycle (cleanup, then setup re-run synchronously in the same
  commit) lands back in a connected state instead of a destroyed one.
- **`destroy()` runs only on a real unmount, decided by a deferred check.**
  The cleanup schedules a task that destroys the provider only if it is
  still detached when the task runs; a StrictMode remount has reattached by
  then. This is what closes the socket and unhooks the Y.Doc handler when
  the user actually leaves the document.
- **Editor options go through `withCollaboration` instead of registering
  `CollaborationExtension` by hand.** The wrapper adds the same extension
  but also disables the local `history` extension (undo flows through
  `Y.UndoManager` only) and sets the collaboration-safe placeholder
  `initialContent` the fragment sync then replaces.
- **The backend e2e suite gains a two-live-clients case**
  (`collab.broadcast.spec.ts`): the existing suite proved sync-down and
  store-on-disconnect but never that an edit broadcasts to a concurrently
  connected client — exactly the path this bug broke.

**Consequences:**

- Development now exercises the same collaboration path as production;
  StrictMode stays on, and this is the pattern for any future component that
  owns a connection-holding resource: reversible cleanup, destruction only
  behind a real-unmount check.
- The deferred destroy leans on React's guarantee that StrictMode's
  simulated remount re-runs effects synchronously in the same commit, before
  any scheduled task fires. If that ever changes, the check degrades to
  destroying a live provider — visible immediately as this same silent
  no-sync symptom in dev.
- The browser-level failure mode (a detached provider behind a
  working-looking editor) is invisible to the backend suites; only a
  browser-driven check catches it. Until an e2e harness for the frontend
  exists, changes to the provider lifecycle warrant a manual two-tab test.

## 55. Comments are BlockNote's comments feature over a `YjsThreadStore` in the shared Y.Doc

**Status: accepted** (2026-08-17) — implemented and verified in the running
app: comment over a selection, mention chip from the `@` menu, resolve,
sidebar filters, an orphaned thread degrading to its quote, and threads
persisting through the existing store hook. One integration hazard surfaced
that the decision must record: **the server's headless projection schema has
to register the comment mark.** y-prosemirror deletes any Y node whose marks
the reading schema cannot construct, so projecting the live Y.Doc through a
schema without the mark silently destroyed every commented text run seconds
after the comment was made. The headless editor now includes
`CommentsExtension` (with an inert thread store) for its mark alone — and the
same rule applies to every future mark carried in the shared fragment,
suggestion marks in phase 5 included: the mark must land in the frontend and
headless schemas in the same change.

**Context:** Phase 4 of the design-doc plan needs threads with replies,
resolution, filters and people mentions, anchored to substrings that survive
concurrent editing. The plan already settles the anchor model: an element-id
`ElementRef` for what a thread is about, plus a mark carried in the shared
document for the position inside it, with the quoted text as evidence
(plan sections 3.8 and 4). BlockNote 0.54 — already the editor — ships a
complete comments feature: a `CommentsExtension` whose comment mark is a
ProseMirror mark synced through the collaboration fragment, UI components
(floating composer, floating thread, a threads sidebar with filter and
position sort), a `resolveUsers` user cache, and pluggable thread stores.
Three storage options were considered: hand-rolled thread records behind REST
endpoints with custom marks (rebuilds what the library ships, and polling or
a second channel for liveness); `RESTYjsThreadStore` (server-authoritative
writes, live reads from the Y.Doc — new routes plus server-side writes into
the hosted document); and `YjsThreadStore` (threads in a `Y.Map` of the same
Y.Doc, client-side writes).

**Decision:**

- **`CommentsExtension` supplies the mark and the UI.** The comment mark
  travels in the shared fragment, which is exactly the durable substring
  anchor the plan asks for — no text re-matching, no custom mark schema.
- **Threads live in a `threads` `Y.Map` inside the design document's own
  Y.Doc, through `YjsThreadStore`.** Sync arrives over the existing `/collab`
  surface and persistence over the existing `onStoreDocument` hook
  (`Y.encodeStateAsUpdate` covers the whole document, map included) — no new
  transport, storage, or routes. The store is keyed by the account login,
  with `DefaultThreadStoreAuth` in the `editor` role.
- **Thread `metadata` carries the plan's anchor pair `{ elementId, quote }`**
  captured at creation, so an orphaned mark degrades a thread to its element
  with the quote as evidence rather than to a dangling pointer.
- **`resolveUsers` reads a new `/ui/accounts` endpoint** serving
  `{ id, name, avatarUrl }` from `Account` nodes; the same list feeds the
  mention menu. The instance is invite-gated, so all accounts may comment.

**Consequences:**

- Comment integrity is client-enforced only: `ThreadStoreAuth` gates the UI,
  but any account that can open the document can technically rewrite other
  people's threads by writing to the `Y.Map` directly. Acceptable for an
  invite-gated instance of trusted collaborators — the same trust decision 53
  already extends to document content. The hardening seam is swapping
  `YjsThreadStore` for `RESTYjsThreadStore` (writes through the backend,
  reads unchanged) without touching the UI.
- Threads stay outside the portable `DesignDocument`: the projection reads
  only the document fragment, so an export never carries comment state
  (plan section 3.8 holds).
- Comment bodies are BlockNote block documents, not plain strings — the
  plan's `Comment` shape in section 3.8 survives as the anchor/metadata
  story, not as a literal stored record.

## 56. Suggestions are prosemirror-suggest-changes marks in the shared Y.Doc

**Status: accepted** (2026-08-18) — implemented and verified in the running
app: suggested insertions and deletions render as marked runs, the rail lists
them with author attribution, accept/reject round-trips (including from a
second browser over the live channel), and the server projection keeps
pending suggestions out of the `DesignDocument` cache until accepted.

**Context:** Phase 5 of the design-doc plan needs Suggesting mode — edits
captured as reviewable suggestions instead of document mutations — with
tracked marks, per-suggestion accept/reject writing through to the model, and
word-level narrowing, all under concurrent editing. The plan's own
`Suggestion` record shape (section 3.8: anchor plus replacement string)
re-implements tracked changes and needs its own reconciliation under
concurrency. Meanwhile `@handlewithcare/prosemirror-suggest-changes` is the
library BlockNote's own xl-ai package (same 0.54 release train) uses for
tracked changes: three ProseMirror marks (`insertion`, `deletion`,
`modification`), a `dispatchTransaction` decorator that transforms edits into
mark-tracked transactions while enabled, and apply/revert commands per
suggestion id or document-wide.

**Decision:**

- **The marks are the store.** Suggestions live as suggest-changes marks in
  the shared fragment — they sync, persist, and rebase under concurrent
  editing exactly as the text they annotate does, with no second record to
  reconcile. The rail's list is a scan of the marks, so every client derives
  the same list. The plan's `Suggestion` contract survives as the
  anchor-and-authorship story, not as a stored record (the same shift
  decision 55 made for comments).
- **Authorship rides in the suggestion id.** Ids are
  `<accountId>:<nonce>` strings minted by a custom `generateId`, so the rail
  attributes a suggestion without a side table that could race, and
  concurrent clients cannot collide the way the library's default
  max-plus-one numeric ids can.
- **The mark definitions are shared.** They live in
  `@repo/design-doc-blocks/suggestion-marks` (the package's one deliberately
  editor-coupled module, excluded from the structural main entry) and are
  registered by the frontend editor and the backend's headless schema from
  the same source — decision 55's rule that a fragment-carried mark must land
  in both schemas in the same change, made structural.
- **Suggesting is a local editor mode.** The Editing / Suggesting toggle
  drives `enableSuggestChanges` per client; the suggest-changes plugin state
  never syncs, so each person picks their own mode (plan §4). A read-only
  Viewing mode was tried and dropped — always-editable is simpler and the
  document is invite-gated anyway.
- **One rail list, Google-Docs style.** Comment threads and pending
  suggestions interleave in a single document-order list. The list shell is
  ours (BlockNote's `ThreadsSidebar` owns its list and cannot interleave
  foreign items) but each thread still renders through BlockNote's exported
  `Thread` component, so thread UI does not fork. Suggestion selection syncs
  both ways — marked text to card, card to marked text — as local UI state.
- **The projection is the accepted document.** Before `toDocument`, the
  server reverts all pending suggestions on a throwaway ProseMirror state —
  suggested insertions drop out, suggested deletions stay — so a pending
  suggestion never leaks into the `DesignDocument` cache, and accepting one
  reaches the model through the ordinary store hook.

- **Suggestion mark parse rules must out-rank the strike style.** The
  marks' `parseDOM` uses attribute selectors (`del[data-id]`,
  `ins[data-id]`) at priority 100: BlockNote's strike style also claims
  bare `del`, and if it wins, ProseMirror's DOM reader re-parses a
  deletion-marked run as struck text, sees a document that differs from
  the view, and dispatches a self-replacing step — which the suggesting
  transform turns into a fresh insertion, growing the document without
  bound (the runaway-duplication incident of 2026-08-18, which also
  corrupted the dev LadybugDB WAL twice).
- **Never mutate ProseMirror's DOM from React.** The active-suggestion
  tint is a dynamic stylesheet in `<head>`, not a class toggled on the
  marked elements: any mutation inside `view.dom` fires ProseMirror's DOM
  observer, whose re-parse is what triggered the runaway above.

**Consequences:**

- **Enter is inert while Suggesting.** The library records a block split as
  zero-width boundary markers, and rejecting a split that opens a block
  leaves the split behind (verified against 0.1.8). Until that reverts
  cleanly, structural suggestions are new blocks via the slash menu and
  removals via the drag-handle menu — both round-trip.
- Suggestion integrity is client-enforced, like decision 55's threads: any
  account that can edit the document can accept or reject any suggestion.
  Acceptable for an invite-gated instance of trusted collaborators.
- Word-level narrowing comes free: the transform marks exactly the inserted
  and deleted runs, so a one-word edit suggests one word.
- The agent never authors suggestions (plan §6); this machinery is the
  human review path only.

## 57. The agent phases (6 and 6b) are dropped from the design-doc iteration

**Status: accepted** (2026-08-19)

**Context:** The design-doc plan closed phases 1–5: model, reading view,
typed collaborative editing, comments with mentions and presence, and
suggestions with the merged review rail. What remained was the agent
surface — phase 6 (chat with schema-bound context, direct application of
requested changes, whole-document proposal review, all mocked) and phase 6b
(the real model behind the same contract).

**Decision:** Phases 6 and 6b are dropped from this iteration. The
workspace ships as a human collaboration tool: typed editing, comments and
suggestions. Section 6 of the plan stays as the design record for agent
integration — the `DesignDocument`-emitting contract, the applied-vs-
proposed rule and the no-agent-suggestions rule all still hold whenever
that work is picked up — but no agent surface is built now, mocked or real.

**Consequences:**

- The iteration is complete; the feature branch can merge without an agent
  panel or any canned-reply plumbing to maintain.
- The scanner-baseline work already left with the codebase-delta feature
  (decision 52); agent integration now joins it as future work, to be
  re-planned as its own iteration when it returns.

## 58. Inbox items are graph nodes under their project; lifecycle moves on conditional writes and read-time sweeps

**Context:** The inbox feature (`docs/work/features/inbox.md`, prototyped in
`inbox-prototype.html`) needs a first implementation: a per-project team
inbox where alerts, transcripts, events and notes land, fold repeats by a
sender-provided dedup key, and end as promoted, dismissed-with-reason, or
expired. The task module the inbox feeds does not exist yet, and the
webhook/API auth model for external senders is an open question — but the
triage lifecycle itself is fully specified and should not wait on either.

**Decision:** An `InboxItem` node table plus a `HasInboxItem` edge from
`Project` — items exist only under their project (the Repository exclusivity
argument), so project deletion removes its inbox outright. Optional STRING
columns store `''` for "absent" and the repository maps them to null at its
edge; occurrence history is a JSON array column capped at the ten most
recent arrivals (first-seen, last-seen and count survive the cap). State
transitions are conditional writes (`WHERE i.state = ...`) in
`InboxRepository`, disambiguated by the service into the 404/409 vocabulary
the routes answer; dedup folding is the one read-then-write, guarded by the
row version. There is no background job: every list read sweeps first —
open events past their start expire, elapsed snoozes wake — so clients
always see items in their true lifecycle state, and the SPA polls the list
every 30s. Intake is two endpoints on the `/ui` surface: manual capture
(note, or transcript when a file's leading text comes along) and a
source-agnostic `/signals` contract (kind, origin, body, dedup key, event
start) that future senders — MCP bridge, calendar, monitoring — reuse
unchanged once the ingest-auth question is answered. Promotion is the
forward-compatible stub the spec demands: state `promoted` plus who/when,
nothing else.

**Consequences:**

- The dedup rule "never guess" is structural: folding matches only an open
  item with the identical key in the same project; a repeat after dismissal
  starts a new item (the reopen/cool-down question stays open).
- Defer is bounded by `event_start` in the service, so no client can snooze
  an event past its moment.
- External systems cannot push yet — `/signals` rides the ui session. When
  the ingest-auth model lands, the endpoint moves (or is mirrored) to the
  `/api` surface with the same schema; nothing in the item model changes.
- Expiry/wake happen at read time, so a project nobody looks at holds stale
  `open` states in the graph until the next read — acceptable while the
  only consumer is the UI that always reads first.

## 59. jsdom stays external to the server bundle and is staged into the runtime image by a minimal install

**Context:** The first Railway deploy after the design-doc phases failed at
the healthcheck: the server crashed on boot with `ENOENT` for
`/repo/node_modules/.bun/jsdom@29.1.1/.../browser/default-stylesheet.css`.
`@blocknote/server-util` (decision 51's headless editor) depends on jsdom,
and jsdom loads its default stylesheet from disk with `fs.readFileSync`
relative to `__dirname` at import time. `bun build` inlines jsdom into
`dist/main.js` and bakes `__dirname` as the build-stage path, which does not
exist in the runtime image — the bundle is only self-contained for code, not
for runtime file reads. Alternatives considered: seeding client-side (breaks
decision 51.6 and still leaves the projection needing the schema),
hand-rolling blocks→Y.Doc over BlockNote internals (drops jsdom entirely but
leans on non-public API), and precomputing seeds at build time (impossible —
`create()` takes arbitrary documents).

**Decision:** Keep `ServerBlockNoteEditor` and fix the packaging. The build
script marks jsdom external (alongside `@ladybugdb/core`), jsdom becomes an
explicit backend dependency, and the Dockerfile stages jsdom's full
dependency closure into `/runtime/node_modules` via a minimal
`bun install --production` of just `{"dependencies":{"jsdom":"<resolved
version>"}}` — the version read from the build stage's installed tree, so
the lockfile stays the single source of truth.

**Consequences:**

- The pattern generalises: any future dependency that reads package files at
  runtime gets the same treatment — external in the build script, staged in
  the Dockerfile. The `@ladybugdb/core` precedent (native binding) and jsdom
  (runtime asset read) are the two instances so far.
- The runtime image grows by jsdom's ~40-package pure-JS closure (a few MB).
- A local `bun run build && bun dist/main.js` now exercises the same
  resolution path as production, since jsdom is a direct backend dependency.

## 60. The UI theme is derived from the noesis.vision palette, not a tweakcn preset

**Context:** The shell shipped on tweakcn's "Claude" preset — a warm theme:
cream page, terracotta primary, warm neutrals — chosen for the prototype
before any brand constraint existed. The marketing site at noesis.vision is
the opposite temperature: white and gray-950 surfaces, `blue-700` buttons,
`blue-950` headings, and a hero gradient running indigo-600 → blue-700 →
green-600, set in Raleway. Users reaching the app from the site crossed a
visible seam. Alternatives considered: swapping only the primary and chart
ramp to brand blue while keeping the warm neutrals (small diff, but the app
still reads warm beside a cool site), and a hybrid keeping terracotta as a
secondary accent (deliberately distinct from the site, which is not what we
want while the app is the site's product).

**Decision:** Replace the whole token set in `server/frontend/src/index.css`
with values sampled from the live site. Every colour is a named Tailwind
default converted to oklch, with the source name in a trailing comment, so
the palette stays legible and re-derivable rather than being an opaque list
of coordinates. `--font-sans` becomes Raleway
(`@fontsource-variable/raleway`), replacing a bare system stack; the
`@fontsource-variable/geist` dependency it supersedes had been imported
since the prototype but was never referenced by a token, so no rendered text
changes typeface for a second time. `--radius` stays at `0.5rem` — the
site's 24px cards and pill buttons are marketing-scale and cost too much
room in a dense shell.

Three places knowingly depart from the site:

- The page is `gray-50` and cards are white. The site puts white cards on a
  white page and separates them with a border alone; the app shell needs a
  real elevation step, so it keeps the page/card relationship the previous
  theme had between cream and white.
- `--input` is `gray-300` where `--border` is `gray-200`. An input outline
  has to hold its own against the card it sits on; a divider does not.
- Dark `--ring` is `blue-600` where `--primary` stays `blue-700`. A focus
  ring on a near-black page needs the extra lightness; a filled button does
  not.

**Consequences:**

- Every text pair in the token set meets WCAG AA or better in both modes
  (lowest: `muted-foreground` on `background` in light at 4.63:1). Dark
  `primary` against `background` is 3.0:1 — a fill, not text, so it meets
  1.4.11's non-text threshold exactly.
- Theme edits are now hand-maintained against this file. tweakcn can still
  be used as an editor by importing the current `:root`/`.dark` blocks, but
  a raw re-export would drop the three deviations above.
- The status-badge tints in the components (blue/green/orange scales) were
  already cool and needed no change.

## 61. Local development gets a `local` auth mode: the real flows against an in-memory GitHub

**Context:** Decision 46 gave contributors `NOESIS_AUTH_MODE=disabled` so the
server would start without a registered GitHub App. It starts, but it does not
get far: the mode has no auth slice at all, so creating a project, connecting a
repository and inviting anyone answer 503, and `/ui/accounts` is a roster of
one. A contributor with no App can browse a workspace someone else's data
directory happens to contain and nothing more, and the project flows — the
newest and most-changed surface — are unreachable without registering an App
against a `localhost` callback. Alternatives considered: a seed script writing
project and repository rows straight into the graph (unblocks browsing, still
never runs the picker or the connect flow), and a personal-access-token mode
(real repositories, but a PAT has no installations and no App identity, so
`RepoAccessService` and the whole picker would need a second code path).

**Decision:**

- **`NOESIS_AUTH_MODE=local` assembles an ordinary `mode: 'github'` module**
  with a synthesized App and an in-memory GitHub behind it. Nothing downstream
  branches on it: sign-in, admission, invites, the repo picker and the access
  check all run their production code, and only the outbound `fetch` is ours.
  The alternative — a third member of the `AuthModule` union — would have made
  every existing `mode === 'github'` check fall through to the 503 branch,
  which is the problem this decision exists to fix.
- **The stand-in is the test fake**, promoted from `test/unit/github-fake.ts`
  to `src/auth/github-fake.ts` and extended with an optional multi-account
  mode. One stand-in serves both, so a flow that works in dev is a flow the
  suites reach the same way, and neither can drift from GitHub's shapes
  without the other noticing.
- **`/auth/login?as=<login>` replaces the trip to github.com** with a redirect
  to our own callback, carrying the chosen login as the authorization code —
  which is exactly what the fake's token endpoint accepts. The `state` cookie
  round-trip is unchanged, so the CSRF check is still exercised. `/auth/install`
  short-circuits the same way, naming an installation the acting account can
  reach.
- **Three identities with different reach** (`octocat` sees a personal and an
  org installation, `alice` and `bob` see only the org), so the per-account
  paths — pickers that differ, a 404 on an installation you cannot see,
  owner-versus-member gating, mentions — are exercisable rather than nominal.
- **`GET /auth/mode` is unauthenticated**, because the sign-in page has to know
  what to offer before a session exists. It reveals only what a deployment's
  login screen already shows.
- **`disabled` stays** as what it always was: no auth slice, for the suites
  that spawn the real server. Both modes refuse `NODE_ENV=production`.

**Consequences:**

- The first identity to sign in claims ownership locally exactly as in
  production, so admitting the second one means using the invite screen. That
  is friction on purpose — it is the only way the invite flow gets exercised
  outside a test.
- Local credentials are minted fresh each boot (a per-process token key, an
  ephemeral RSA key for the App JWT), so a restart signs everyone out. The
  graph survives; the session does not.
- The fake now ships in `src/`. It is dead code in a production image — both
  modes that reach it refuse to start there — and that is the price of the
  single stand-in.
- `/ui/me`'s `authMode` and `/auth/mode` are the only two places that can tell
  `local` from `github`, via `authModeName`. Everything else is deliberately
  unable to.
- A local project is bound to a fake installation and fake repository ids, so a
  data directory built under `local` is not one a `github`-mode server can make
  sense of. `bun run dev:local` keeps them apart by pointing `NOESIS_DATA_DIR`
  at `.data-local`.

## 62. Shutdown flushes collab stores before closing the database; a torn WAL is reported, and discarded only on request

**Context:** The deployed server crash-looped for a day on
`Runtime exception: Corrupted wal file. Read out invalid WAL record type.` The
image built and pushed fine; the container died on the first query of every
boot, so the healthcheck never passed and the platform restarted it into the
same failure. LadybugDB keeps a write-ahead log beside the database file on the
mounted volume, and a process killed mid-write leaves it torn.

The mechanism was ours. `DesignDocCollabService.close()` called Hocuspocus's
`closeConnections()`, whose name and our comment both promised a flush it does
not perform: it drops the sockets and leaves the debounced `onStoreDocument`
timers pending. The composition root then closed the database and called
`process.exit(0)` immediately, so a debounced store could fire against a
database that was closing or already closed. `sleepApplication` is on for the
service, so that path runs on every idle cycle rather than only on deploys.

**Decision:**

- **Collab shutdown drains rather than disconnects.** `close()` registers an
  `afterUnloadDocument` hook, closes connections, calls `flushPendingStores()`,
  and waits for the document count to reach zero — the sequence Hocuspocus's
  own `Server.runDestroy` uses. We cannot call that method: we embed the
  `Hocuspocus` instance in `Bun.serve` rather than running its HTTP server.
- **The drain is bounded (5 s), unlike upstream's.** The platform sends SIGKILL
  after its grace period, and exiting with the database closed beats being
  killed with a store half-written. A timeout logs how many documents were
  still unloading.
- **`shutdown()` is idempotent and closes the database in a `finally`.** A
  second signal must not start a second teardown — two `db.close()` calls
  racing on one native handle is the very thing that tears the log — and a
  failure in the collab flush must not skip closing the database.
- **A torn log is reported, not silently repaired.** The boot path recognises
  the error and says what it means and what to do. `NOESIS_RECOVER_WAL=1`
  deletes the log and retries once. Opt-in, because it loses the transactions
  written since the last checkpoint and that is an operator's call.
- **Collab order stays first in shutdown**, before `server.stop()`: `stop()`
  waits for open connections, and the `/collab` WebSockets are open until the
  collab service closes them.

**Consequences:**

- The e2e suite gains the case that actually failed: edit, leave the client
  attached, call `close()` inside the debounce window, and assert the edit
  reached the graph. It fails against the old `closeConnections()` body.
- `DatabaseService` now exposes `walPath`, because the composition root is what
  decides to delete it and should not be rebuilding the file naming by hand.
- Recovery needed a code path rather than a one-off platform command: Railway's
  `redeploy` reuses the previous deployment's config snapshot, so a start
  command set on the service does not run until something triggers a genuinely
  new deployment. An env-gated recovery ships with the image and needs no such
  trigger.
- `NOESIS_RECOVER_WAL` should be unset once a recovery is done. Left on, it
  turns the next torn log into silent data loss instead of a loud failure.
- The recovery must not `await db.close()` on the failure path. Closing tries
  to checkpoint the very log that is torn and throws the same error, so the
  first version of this recovery deleted nothing and crash-looped exactly like
  the boot it was meant to fix. The close is best-effort; unlinking the file
  out from under an unusable handle is the point.
- None of this makes an embedded single-writer database safe under arbitrary
  kills — it narrows the window to writes actually in flight when SIGKILL
  lands. If that stops being good enough, the answer is a server-based store,
  not more shutdown hardening.
